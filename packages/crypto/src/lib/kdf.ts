import { getSodium } from './sodium.js';

/**
 * Derives a 32-byte Key Encryption Key (KEK) from a password and salt using Argon2id.
 *
 * Default parameters use `OPSLIMIT_SENSITIVE` + `MEMLIMIT_SENSITIVE` for strong server-side
 * protection. Pass explicit opsLimit/memLimit (e.g. `OPSLIMIT_MIN`) in tests to avoid multi-second
 * delays — never in production.
 *
 * @param salt - 16-byte random salt from `generateSalt()`. Never reuse across accounts.
 * @param opsLimit - Argon2id CPU iterations. Default: SENSITIVE (~4 ops).
 * @param memLimit - Argon2id memory in bytes. Default: SENSITIVE (~1 GB).
 */
export async function deriveKeyEncryptionKey(
  password: string,
  salt: Uint8Array,
  opsLimit?: number,
  memLimit?: number,
): Promise<Uint8Array> {
  const sodium = await getSodium();
  /* c8 ignore start */
  const ops = opsLimit ?? sodium.crypto_pwhash_OPSLIMIT_SENSITIVE;
  const mem = memLimit ?? sodium.crypto_pwhash_MEMLIMIT_SENSITIVE;
  /* c8 ignore stop */
  return sodium.crypto_pwhash(
    sodium.crypto_secretbox_KEYBYTES,
    password,
    salt,
    ops,
    mem,
    sodium.crypto_pwhash_ALG_ARGON2ID13,
  );
}
