import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const SALT_BYTES = 16;
const HASH_BYTES = 32;

export function hash(
  verifier: string,
  salt: Buffer = randomBytes(SALT_BYTES),
): {
  hash: string;
  salt: Buffer;
} {
  return { hash: scryptSync(verifier, salt, HASH_BYTES).toString('hex'), salt };
}

export function verify(
  verifier: string,
  expectedHash: string | null,
  salt: Buffer | null,
): boolean {
  if (!expectedHash || !salt) return false;
  const actual = scryptSync(verifier, salt, HASH_BYTES).toString('hex');
  const a = Buffer.from(actual, 'hex');
  const b = Buffer.from(expectedHash, 'hex');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
