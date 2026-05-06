import type Fastify from 'fastify';
import { generateKeyPair, generateTotpCode } from '@blindpass/crypto';
import type { KeyPair } from '@blindpass/types';

export function makeRegisterBody(username: string, publicKey: Uint8Array) {
  return {
    username,
    kekSalt: Buffer.from('salt').toString('base64'),
    publicKey: Buffer.from(publicKey).toString('base64'),
    encryptedMasterKey: {
      ciphertext: Buffer.from('mc').toString('base64'),
      nonce: Buffer.from('mn').toString('base64'),
    },
    encryptedMasterKeyForRecovery: {
      ciphertext: Buffer.from('mrc').toString('base64'),
      nonce: Buffer.from('mrn').toString('base64'),
    },
    encryptedPrivateKey: {
      ciphertext: Buffer.from('pc').toString('base64'),
      nonce: Buffer.from('pn').toString('base64'),
    },
    encryptedRecoveryKey: {
      ciphertext: Buffer.from('rc').toString('base64'),
      nonce: Buffer.from('rn').toString('base64'),
    },
    encryptedVaultKey: {
      ciphertext: Buffer.from('vc').toString('base64'),
      nonce: Buffer.from('vn').toString('base64'),
    },
    encryptedVaultData: {
      ciphertext: Buffer.from('vdc').toString('base64'),
      nonce: Buffer.from('vdn').toString('base64'),
    },
    recoveryVerifier: Buffer.from(`recovery:${username}`).toString('base64'),
  };
}

let _usernameCounter = 0;

export function uniqueUsername(): string {
  _usernameCounter += 1;
  return `test_${Date.now()}_${_usernameCounter}`;
}

function extractSessionCookie(setCookie: string | string[] | undefined): string {
  const cookieStr = Array.isArray(setCookie) ? setCookie.join(', ') : (setCookie ?? '');
  const match = cookieStr.match(/bp_session=([^;,\s]+)/);
  if (!match) throw new Error('bp_session cookie not present in Set-Cookie header');
  return match[1];
}

/**
 * Registers a user, completes authenticator enrollment, and returns the
 * plaintext bearer token extracted from the Set-Cookie header.
 */
export async function registerAndLogin(
  app: ReturnType<typeof Fastify>,
  username?: string,
  keyPair?: KeyPair,
): Promise<string> {
  const result = await registerAndLoginWithDetails(app, username, keyPair);
  return result.authToken;
}

export async function registerAndLoginWithDetails(
  app: ReturnType<typeof Fastify>,
  username?: string,
  keyPair?: KeyPair,
): Promise<{ authToken: string; username: string; setupKey: string; keyPair: KeyPair }> {
  const u = username ?? uniqueUsername();
  const kp = keyPair ?? (await generateKeyPair());
  const registerRes = await app.inject({
    method: 'POST',
    url: '/auth/register',
    body: makeRegisterBody(u, kp.publicKey),
  });
  const { enrollment } = registerRes.json() as {
    enrollment: { enrollmentId: string; setupKey: string };
  };
  const authenticatorCode = generateTotpCode(enrollment.setupKey);
  const res = await app.inject({
    method: 'POST',
    url: '/auth/register/complete',
    body: { username: u, enrollmentId: enrollment.enrollmentId, authenticatorCode },
  });
  return {
    authToken: extractSessionCookie(res.headers['set-cookie']),
    username: u,
    setupKey: enrollment.setupKey,
    keyPair: kp,
  };
}

/**
 * Single-user helper: returns the keypair, the registration body that was sent,
 * and a plaintext authToken. Tests that compare GET /user/keys output back to
 * the request body use the returned `registerBody`.
 */
export async function setupTestUser(
  app: ReturnType<typeof Fastify>,
  username: string,
): Promise<{
  keyPair: KeyPair;
  registerBody: ReturnType<typeof makeRegisterBody>;
  authToken: string;
  setupKey: string;
}> {
  const keyPair = await generateKeyPair();
  const registerBody = makeRegisterBody(username, keyPair.publicKey);
  const registerRes = await app.inject({
    method: 'POST',
    url: '/auth/register',
    body: registerBody,
  });
  const { enrollment } = registerRes.json() as {
    enrollment: { enrollmentId: string; setupKey: string };
  };
  const authenticatorCode = generateTotpCode(enrollment.setupKey);
  const res = await app.inject({
    method: 'POST',
    url: '/auth/register/complete',
    body: { username, enrollmentId: enrollment.enrollmentId, authenticatorCode },
  });
  const authToken = extractSessionCookie(res.headers['set-cookie']);
  return { keyPair, registerBody, authToken, setupKey: enrollment.setupKey };
}
