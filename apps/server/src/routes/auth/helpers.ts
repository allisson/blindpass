import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from 'node:crypto';
import type { FastifyReply } from 'fastify';
import { generateTotpCode } from '@blindpass/crypto';
import { env } from '../../env.js';
import { b64, toB64 } from '../../utils/base64.js';
import { hashToken } from '../../utils/otp.js';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const TOTP_PERIOD_SECONDS = 30;
const TOTP_DIGITS = 6;
const GCM_IV_BYTES = 12;
const GCM_TAG_BYTES = 16;

export function issueSessionToken(): string {
  return randomBytes(32).toString('hex');
}

export function setAuthCookie(reply: FastifyReply, authToken: string): void {
  reply.setCookie(env.COOKIE_NAME, authToken, {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: 'strict',
    path: '/',
    domain: env.COOKIE_DOMAIN,
    maxAge: Math.floor(env.SESSION_TTL_MS / 1000),
  });
}

export function buildAuthBundle(user: {
  publicKey: Buffer | null;
  kekSalt: Buffer | null;
  encryptedMasterKeyCiphertext: Buffer | null;
  encryptedMasterKeyNonce: Buffer | null;
  encryptedMasterKeyForRecoveryCiphertext: Buffer | null;
  encryptedMasterKeyForRecoveryNonce: Buffer | null;
  encryptedPrivateKeyCiphertext: Buffer | null;
  encryptedPrivateKeyNonce: Buffer | null;
  encryptedRecoveryKeyCiphertext: Buffer | null;
  encryptedRecoveryKeyNonce: Buffer | null;
}) {
  return {
    publicKey: toB64(user.publicKey),
    kekSalt: toB64(user.kekSalt),
    encryptedMasterKey: {
      ciphertext: toB64(user.encryptedMasterKeyCiphertext),
      nonce: toB64(user.encryptedMasterKeyNonce),
    },
    encryptedMasterKeyForRecovery: {
      ciphertext: toB64(user.encryptedMasterKeyForRecoveryCiphertext),
      nonce: toB64(user.encryptedMasterKeyForRecoveryNonce),
    },
    encryptedPrivateKey: {
      ciphertext: toB64(user.encryptedPrivateKeyCiphertext),
      nonce: toB64(user.encryptedPrivateKeyNonce),
    },
    encryptedRecoveryKey: {
      ciphertext: toB64(user.encryptedRecoveryKeyCiphertext),
      nonce: toB64(user.encryptedRecoveryKeyNonce),
    },
  };
}

export function createTotpEnrollment(
  username: string,
  expiresAt: Date,
): { secret: string; encryptedSecret: Buffer; otpauthUri: string; expiresAt: string } {
  const secret = base32Encode(randomBytes(20));
  return {
    secret,
    encryptedSecret: encryptTotpSecret(secret),
    otpauthUri:
      `otpauth://totp/${encodeURIComponent(`BlindPass:${username}`)}` +
      `?secret=${secret}&issuer=BlindPass&algorithm=SHA1&digits=6&period=30`,
    expiresAt: expiresAt.toISOString(),
  };
}

export function encryptTotpSecret(secret: string): Buffer {
  const iv = randomBytes(GCM_IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', getTotpSecretKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ciphertext]);
}

export function decryptTotpSecret(payload: Buffer): string {
  const iv = payload.subarray(0, GCM_IV_BYTES);
  const tag = payload.subarray(GCM_IV_BYTES, GCM_IV_BYTES + GCM_TAG_BYTES);
  const ciphertext = payload.subarray(GCM_IV_BYTES + GCM_TAG_BYTES);
  const decipher = createDecipheriv('aes-256-gcm', getTotpSecretKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

export function verifyTotpCode(
  secret: string,
  code: string,
  lastUsedCounter: number | null | undefined,
  now: number = Date.now(),
): number | null {
  const currentCounter = Math.floor(now / (TOTP_PERIOD_SECONDS * 1000));
  for (const offset of [-1, 0, 1]) {
    const counter = currentCounter + offset;
    if (lastUsedCounter != null && counter <= lastUsedCounter) continue;
    const expected = generateTotpCode(
      secret,
      { algorithm: 'SHA1', digits: TOTP_DIGITS, period: TOTP_PERIOD_SECONDS },
      counter * TOTP_PERIOD_SECONDS * 1000,
    );
    if (timingSafeEqual(Buffer.from(expected), Buffer.from(code))) {
      return counter;
    }
  }
  return null;
}

export function hashRecoveryVerifierInput(
  verifier: string,
  salt: Buffer = randomBytes(16),
): { hash: string; salt: Buffer } {
  return { hash: scryptSync(verifier, salt, 32).toString('hex'), salt };
}

export function verifyRecoveryVerifierInput(
  verifier: string,
  expectedHash: string | null,
  salt: Buffer | null,
): boolean {
  if (!expectedHash || !salt) return false;
  const actual = scryptSync(verifier, salt, 32).toString('hex');
  return timingSafeEqual(Buffer.from(actual, 'hex'), Buffer.from(expectedHash, 'hex'));
}

export function isUserStaleUnverified(user: { verified: boolean; createdAt: Date }): boolean {
  return !user.verified && Date.now() - user.createdAt.getTime() >= env.UNVERIFIED_ACCOUNT_TTL_MS;
}

export function insertSessionValues(userId: string, authToken: string, userAgent?: string) {
  return {
    userId,
    tokenHash: hashToken(authToken),
    expiresAt: new Date(Date.now() + env.SESSION_TTL_MS),
    userAgent,
  };
}

function base32Encode(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
}

function getTotpSecretKey(): Buffer {
  const key = b64(env.TOTP_SECRET_ENCRYPTION_KEY);
  if (key.length !== 32) {
    throw new Error('TOTP_SECRET_ENCRYPTION_KEY must decode to 32 bytes');
  }
  return key;
}
