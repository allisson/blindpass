import type { EncryptedValue } from '@blindpass/types';
import { generateKey } from '../lib/random.js';
import { encryptSymmetric, decryptSymmetric } from '../lib/symmetric.js';

/** Generates a fresh 32-byte vault key. Encrypted by the master key before leaving memory. */
export async function generateVaultKey(): Promise<Uint8Array> {
  return generateKey();
}

/** Wraps the vault key under the master key. */
export async function encryptVaultKey(
  vaultKey: Uint8Array,
  masterKey: Uint8Array,
): Promise<EncryptedValue> {
  return encryptSymmetric(vaultKey, masterKey);
}

/** Unwraps the vault key using the master key. Throws `CryptoError` on wrong master key. */
export async function decryptVaultKey(
  encrypted: EncryptedValue,
  masterKey: Uint8Array,
): Promise<Uint8Array> {
  return decryptSymmetric(encrypted, masterKey);
}
