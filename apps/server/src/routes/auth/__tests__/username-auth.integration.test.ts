import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { generateKeyPair, generateTotpCode } from '@blindpass/crypto';
import type Fastify from 'fastify';
import { buildIntegrationApp } from '../../../test/build-app.integration.js';
import { makeRegisterBody, uniqueUsername } from '../../../test/auth-helpers.js';
import { resetDatabase } from '../../../test/reset-db.integration.js';

const apps: ReturnType<typeof Fastify>[] = [];

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

beforeEach(async () => {
  await resetDatabase();
});

describe('username auth flow', () => {
  it('registers and completes authenticator enrollment', async () => {
    const app = await buildIntegrationApp();
    apps.push(app);
    const username = uniqueUsername();
    const keyPair = await generateKeyPair();

    const registerRes = await app.inject({
      method: 'POST',
      url: '/auth/register',
      body: makeRegisterBody(username, keyPair.publicKey),
    });
    expect(registerRes.statusCode).toBe(201);
    const { enrollment } = registerRes.json() as {
      enrollment: { enrollmentId: string; setupKey: string; otpauthUri: string };
    };
    expect(enrollment.otpauthUri).toContain(username);

    const completeRes = await app.inject({
      method: 'POST',
      url: '/auth/register/complete',
      body: {
        username,
        enrollmentId: enrollment.enrollmentId,
        authenticatorCode: generateTotpCode(enrollment.setupKey),
      },
    });
    expect(completeRes.statusCode).toBe(200);
    expect(completeRes.headers['set-cookie']).toContain('bp_session=');
  });

  it('rejects duplicate usernames', async () => {
    const app = await buildIntegrationApp();
    apps.push(app);
    const username = uniqueUsername();
    const keyPair = await generateKeyPair();

    await app.inject({
      method: 'POST',
      url: '/auth/register',
      body: makeRegisterBody(username, keyPair.publicKey),
    });
    const duplicateRes = await app.inject({
      method: 'POST',
      url: '/auth/register',
      body: makeRegisterBody(username, keyPair.publicKey),
    });
    expect(duplicateRes.statusCode).toBe(409);
  });

  it('starts and completes login for a verified user', async () => {
    let now = Date.parse('2035-05-05T12:00:00.000Z');
    vi.spyOn(Date, 'now').mockImplementation(() => now);

    const app = await buildIntegrationApp();
    apps.push(app);
    const username = uniqueUsername();
    const keyPair = await generateKeyPair();

    const registerRes = await app.inject({
      method: 'POST',
      url: '/auth/register',
      body: makeRegisterBody(username, keyPair.publicKey),
    });
    const { enrollment } = registerRes.json() as {
      enrollment: { enrollmentId: string; setupKey: string };
    };

    const completeRegistrationRes = await app.inject({
      method: 'POST',
      url: '/auth/register/complete',
      body: {
        username,
        enrollmentId: enrollment.enrollmentId,
        authenticatorCode: generateTotpCode(enrollment.setupKey),
      },
    });
    expect(completeRegistrationRes.statusCode).toBe(200);

    now += 30_000;

    const startRes = await app.inject({
      method: 'POST',
      url: '/auth/login/start',
      body: { username },
    });
    expect(startRes.statusCode).toBe(200);
    expect(startRes.json()).toMatchObject({
      message: 'If the account exists, continue with your authenticator code.',
    });

    const completeLoginRes = await app.inject({
      method: 'POST',
      url: '/auth/login/complete',
      body: {
        username,
        authenticatorCode: generateTotpCode(enrollment.setupKey),
      },
      headers: { 'user-agent': 'vitest-login' },
    });
    expect(completeLoginRes.statusCode).toBe(200);
    expect(completeLoginRes.headers['set-cookie']).toContain('bp_session=');
  });

  it('clears a stale unverified account during login start', async () => {
    let now = Date.parse('2035-05-05T12:00:00.000Z');
    vi.spyOn(Date, 'now').mockImplementation(() => now);

    const app = await buildIntegrationApp();
    apps.push(app);
    const username = uniqueUsername();
    const keyPair = await generateKeyPair();

    const firstRegisterRes = await app.inject({
      method: 'POST',
      url: '/auth/register',
      body: makeRegisterBody(username, keyPair.publicKey),
    });
    expect(firstRegisterRes.statusCode).toBe(201);

    now += 24 * 60 * 60 * 1000 + 1;

    const startRes = await app.inject({
      method: 'POST',
      url: '/auth/login/start',
      body: { username },
    });
    expect(startRes.statusCode).toBe(200);

    const secondRegisterRes = await app.inject({
      method: 'POST',
      url: '/auth/register',
      body: makeRegisterBody(username, keyPair.publicKey),
    });
    expect(secondRegisterRes.statusCode).toBe(201);
  });

  it('does not leak the session token into completion-route response bodies', async () => {
    let now = Date.parse('2035-05-05T12:00:00.000Z');
    vi.spyOn(Date, 'now').mockImplementation(() => now);

    const app = await buildIntegrationApp();
    apps.push(app);
    const username = uniqueUsername();
    const keyPair = await generateKeyPair();

    const registerRes = await app.inject({
      method: 'POST',
      url: '/auth/register',
      body: makeRegisterBody(username, keyPair.publicKey),
    });
    const { enrollment } = registerRes.json() as {
      enrollment: { enrollmentId: string; setupKey: string };
    };

    const completeRegistrationRes = await app.inject({
      method: 'POST',
      url: '/auth/register/complete',
      body: {
        username,
        enrollmentId: enrollment.enrollmentId,
        authenticatorCode: generateTotpCode(enrollment.setupKey),
      },
    });
    const registrationCookie = extractSessionToken(completeRegistrationRes.headers['set-cookie']);
    expect(registrationCookie).toMatch(/^[0-9a-f]{64}$/);
    expectBodyDoesNotLeak(completeRegistrationRes.body, registrationCookie);

    now += 30_000;

    const completeLoginRes = await app.inject({
      method: 'POST',
      url: '/auth/login/complete',
      body: {
        username,
        authenticatorCode: generateTotpCode(enrollment.setupKey),
      },
    });
    const loginCookie = extractSessionToken(completeLoginRes.headers['set-cookie']);
    expect(loginCookie).toMatch(/^[0-9a-f]{64}$/);
    expectBodyDoesNotLeak(completeLoginRes.body, loginCookie);
  });
});

function extractSessionToken(setCookie: string | string[] | undefined): string {
  const cookieStr = Array.isArray(setCookie) ? setCookie.join(', ') : (setCookie ?? '');
  const match = cookieStr.match(/bp_session=([0-9a-f]+)/);
  if (!match) throw new Error('bp_session cookie not present in Set-Cookie header');
  return match[1];
}

function expectBodyDoesNotLeak(body: string, token: string): void {
  expect(body).not.toContain(token);
  expect(body).not.toContain(Buffer.from(token, 'hex').toString('base64'));
  // Re-serialise the parsed JSON so encoded copies (e.g. nested under a key)
  // would surface even if the raw body happens not to contain the substring.
  const parsed: unknown = JSON.parse(body);
  expect(JSON.stringify(parsed)).not.toContain(token);
}
