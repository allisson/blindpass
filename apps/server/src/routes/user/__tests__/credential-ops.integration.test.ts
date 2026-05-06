import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { generateKeyPair, generateTotpCode } from '@blindpass/crypto';
import type Fastify from 'fastify';
import { buildIntegrationApp } from '../../../test/build-app.integration.js';
import { resetDatabase } from '../../../test/reset-db.integration.js';
import {
  makeRegisterBody,
  registerAndLoginWithDetails,
  setupTestUser,
  uniqueUsername,
} from '../../../test/auth-helpers.js';

const apps: ReturnType<typeof Fastify>[] = [];

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

beforeEach(async () => {
  await resetDatabase();
});

describe('credential operations', () => {
  it('changes password with a fresh authenticator code and revokes sessions', async () => {
    const app = await buildIntegrationApp();
    apps.push(app);
    const { authToken, setupKey } = await setupTestUser(app, uniqueUsername());

    const res = await app.inject({
      method: 'PUT',
      url: '/user/password',
      headers: { authorization: `Bearer ${authToken}` },
      body: {
        authenticatorCode: generateTotpCode(setupKey, undefined, Date.now() + 30_000),
        kekSalt: Buffer.from('next-salt').toString('base64'),
        encryptedMasterKey: {
          ciphertext: Buffer.from('next-c').toString('base64'),
          nonce: Buffer.from('next-n').toString('base64'),
        },
      },
    });
    expect(res.statusCode).toBe(200);

    const sessionsRes = await app.inject({
      method: 'GET',
      url: '/auth/sessions',
      headers: { authorization: `Bearer ${authToken}` },
    });
    expect(sessionsRes.statusCode).toBe(401);
  });

  it('deletes a non-admin account with a fresh authenticator code', async () => {
    const app = await buildIntegrationApp();
    apps.push(app);
    await registerAndLoginWithDetails(app, uniqueUsername());
    const target = await registerAndLoginWithDetails(app, uniqueUsername());

    const res = await app.inject({
      method: 'DELETE',
      url: '/user',
      headers: { authorization: `Bearer ${target.authToken}` },
      body: {
        authenticatorCode: generateTotpCode(target.setupKey, undefined, Date.now() + 30_000),
      },
    });
    expect(res.statusCode).toBe(200);

    const sessionsRes = await app.inject({
      method: 'GET',
      url: '/auth/sessions',
      headers: { authorization: `Bearer ${target.authToken}` },
    });
    expect(sessionsRes.statusCode).toBe(401);
  });

  it('recovers an account with the recovery phrase and replaces active sessions', async () => {
    let now = Date.parse('2035-05-05T12:00:00.000Z');
    vi.spyOn(Date, 'now').mockImplementation(() => now);

    const app = await buildIntegrationApp();
    apps.push(app);
    const username = uniqueUsername();
    const { authToken, registerBody } = await setupTestUser(app, username);

    const startRes = await app.inject({
      method: 'POST',
      url: '/auth/recovery/start',
      body: { username },
    });
    expect(startRes.statusCode).toBe(200);
    expect(startRes.json()).toMatchObject({
      message: 'If the account exists, continue with your recovery phrase.',
    });

    const verifyRes = await app.inject({
      method: 'POST',
      url: '/auth/recovery/verify',
      body: {
        username,
        recoveryVerifier: registerBody.recoveryVerifier,
      },
    });
    expect(verifyRes.statusCode).toBe(200);
    const verified = verifyRes.json() as {
      recoveryToken: string;
      enrollment: { enrollmentId: string; setupKey: string };
      bundle: { publicKey: string };
    };
    expect(verified.bundle.publicKey).toBe(registerBody.publicKey);

    now += 30_000;

    const nextKeyPair = await generateKeyPair();
    const nextBody = makeRegisterBody(username, nextKeyPair.publicKey);
    const completeRes = await app.inject({
      method: 'POST',
      url: '/auth/recovery/complete',
      headers: { 'user-agent': 'vitest-recovery' },
      body: {
        username,
        recoveryToken: verified.recoveryToken,
        enrollmentId: verified.enrollment.enrollmentId,
        authenticatorCode: generateTotpCode(verified.enrollment.setupKey),
        kekSalt: nextBody.kekSalt,
        publicKey: nextBody.publicKey,
        encryptedMasterKey: nextBody.encryptedMasterKey,
        encryptedMasterKeyForRecovery: nextBody.encryptedMasterKeyForRecovery,
        encryptedPrivateKey: nextBody.encryptedPrivateKey,
        encryptedRecoveryKey: nextBody.encryptedRecoveryKey,
        recoveryVerifier: nextBody.recoveryVerifier,
      },
    });
    expect(completeRes.statusCode).toBe(200);
    expect(completeRes.headers['set-cookie']).toContain('bp_session=');
    expect(completeRes.json()).toMatchObject({
      publicKey: nextBody.publicKey,
      kekSalt: nextBody.kekSalt,
    });

    const oldSessionsRes = await app.inject({
      method: 'GET',
      url: '/auth/sessions',
      headers: { authorization: `Bearer ${authToken}` },
    });
    expect(oldSessionsRes.statusCode).toBe(401);
  });

  it('rotates the authenticator and recovery phrase with fresh codes', async () => {
    let now = Date.parse('2035-05-05T12:00:00.000Z');
    vi.spyOn(Date, 'now').mockImplementation(() => now);

    const app = await buildIntegrationApp();
    apps.push(app);
    const username = uniqueUsername();
    const { authToken, setupKey } = await setupTestUser(app, username);

    now += 30_000;

    const startRotationRes = await app.inject({
      method: 'POST',
      url: '/user/totp/rotate/start',
      headers: { authorization: `Bearer ${authToken}` },
      body: { authenticatorCode: generateTotpCode(setupKey) },
    });
    expect(startRotationRes.statusCode).toBe(200);
    const { enrollment } = startRotationRes.json() as {
      enrollment: { enrollmentId: string; setupKey: string };
    };

    now += 30_000;

    const completeRotationRes = await app.inject({
      method: 'POST',
      url: '/user/totp/rotate/complete',
      headers: { authorization: `Bearer ${authToken}` },
      body: {
        enrollmentId: enrollment.enrollmentId,
        authenticatorCode: generateTotpCode(enrollment.setupKey),
      },
    });
    expect(completeRotationRes.statusCode).toBe(200);

    const revokedSessionsRes = await app.inject({
      method: 'GET',
      url: '/auth/sessions',
      headers: { authorization: `Bearer ${authToken}` },
    });
    expect(revokedSessionsRes.statusCode).toBe(401);

    const startLoginRes = await app.inject({
      method: 'POST',
      url: '/auth/login/start',
      body: { username },
    });
    expect(startLoginRes.statusCode).toBe(200);

    now += 30_000;

    const loginRes = await app.inject({
      method: 'POST',
      url: '/auth/login/complete',
      headers: { 'user-agent': 'vitest-rotation-login' },
      body: {
        username,
        authenticatorCode: generateTotpCode(enrollment.setupKey),
      },
    });
    expect(loginRes.statusCode).toBe(200);
    const sessionCookie = Array.isArray(loginRes.headers['set-cookie'])
      ? loginRes.headers['set-cookie'].join(';')
      : (loginRes.headers['set-cookie'] ?? '');
    const sessionToken = sessionCookie.match(/bp_session=([^;]+)/)?.[1];
    expect(sessionToken).toBeDefined();

    now += 30_000;

    const nextKeyPair = await generateKeyPair();
    const nextBody = makeRegisterBody(username, nextKeyPair.publicKey);
    const rotateRecoveryRes = await app.inject({
      method: 'PUT',
      url: '/user/recovery-phrase',
      headers: { authorization: `Bearer ${sessionToken}` },
      body: {
        authenticatorCode: generateTotpCode(enrollment.setupKey),
        publicKey: nextBody.publicKey,
        encryptedMasterKeyForRecovery: nextBody.encryptedMasterKeyForRecovery,
        encryptedPrivateKey: nextBody.encryptedPrivateKey,
        encryptedRecoveryKey: nextBody.encryptedRecoveryKey,
        recoveryVerifier: nextBody.recoveryVerifier,
      },
    });
    expect(rotateRecoveryRes.statusCode).toBe(200);
    expect(rotateRecoveryRes.json()).toMatchObject({ message: 'Recovery phrase rotated' });
  });
});
