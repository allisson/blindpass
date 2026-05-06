import type { EncryptedValue } from '@blindpass/types';
import { generateKey } from '../lib/random.js';
import { encryptSymmetric, decryptSymmetric } from '../lib/symmetric.js';

/** Generates a fresh 32-byte master key. Encrypted by the KEK before leaving memory. */
export async function generateMasterKey(): Promise<Uint8Array> {
  return generateKey();
}

/** Wraps the master key under the Key Encryption Key (KEK) derived from the user's password. */
export async function encryptMasterKey(
  masterKey: Uint8Array,
  kek: Uint8Array,
): Promise<EncryptedValue> {
  return encryptSymmetric(masterKey, kek);
}

/**
 * Unwraps the master key using the KEK. Throws `CryptoError` on wrong KEK (wrong password)
 * or corrupted ciphertext.
 */
export async function decryptMasterKey(
  encrypted: EncryptedValue,
  kek: Uint8Array,
): Promise<Uint8Array> {
  return decryptSymmetric(encrypted, kek);
}
