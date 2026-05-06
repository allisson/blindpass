import type { EncryptedValue } from '@blindpass/types';
import { getSodium } from './sodium.js';
import { generateNonce } from './random.js';
import { CryptoError } from '../errors.js';

/**
 * Encrypts plaintext with XSalsa20-Poly1305. Generates a random 24-byte nonce per call.
 * @param key - 32-byte symmetric key from `generateKey()` or a derived key.
 */
export async function encryptSymmetric(
  plaintext: Uint8Array,
  key: Uint8Array,
): Promise<EncryptedValue> {
  const sodium = await getSodium();
  const nonce = await generateNonce();
  const ciphertext = sodium.crypto_secretbox_easy(plaintext, nonce, key);
  return { ciphertext, nonce };
}

/**
 * Decrypts an XSalsa20-Poly1305 ciphertext. Throws `CryptoError` if authentication fails
 * (wrong key or tampered data). Ciphertext and nonce must match what `encryptSymmetric` produced.
 */
export async function decryptSymmetric(
  encrypted: EncryptedValue,
  key: Uint8Array,
): Promise<Uint8Array> {
  const sodium = await getSodium();
  /* c8 ignore start — libsodium throws on auth failure; v8 can't attribute async catch branch */
  try {
    return sodium.crypto_secretbox_open_easy(encrypted.ciphertext, encrypted.nonce, key);
  } catch {
    throw new CryptoError('Decryption failed: invalid key or corrupted data');
  }
  /* c8 ignore stop */
}
