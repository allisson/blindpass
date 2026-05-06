import { getSodium } from './sodium.js';

/** Generates a cryptographically random 32-byte symmetric key. */
export async function generateKey(): Promise<Uint8Array> {
  const sodium = await getSodium();
  return sodium.crypto_secretbox_keygen();
}

/** Generates a cryptographically random 24-byte nonce for XSalsa20-Poly1305. Never reuse. */
export async function generateNonce(): Promise<Uint8Array> {
  const sodium = await getSodium();
  return sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES);
}

/** Generates a cryptographically random 16-byte salt for Argon2id KDF. Never reuse per account. */
export async function generateSalt(): Promise<Uint8Array> {
  const sodium = await getSodium();
  return sodium.randombytes_buf(sodium.crypto_pwhash_SALTBYTES);
}
