import type { EncryptedValue } from '@blindpass/types';
import { generateKey } from '../lib/random.js';
import { encryptSymmetric, decryptSymmetric } from '../lib/symmetric.js';

/** Generates a fresh 32-byte item key. Each vault item has its own key for granular access control. */
export async function generateItemKey(): Promise<Uint8Array> {
  return generateKey();
}

/** Wraps the item key under the vault key. */
export async function encryptItemKey(
  itemKey: Uint8Array,
  vaultKey: Uint8Array,
): Promise<EncryptedValue> {
  return encryptSymmetric(itemKey, vaultKey);
}

/** Unwraps the item key using the vault key. Throws `CryptoError` on wrong vault key. */
export async function decryptItemKey(
  encrypted: EncryptedValue,
  vaultKey: Uint8Array,
): Promise<Uint8Array> {
  return decryptSymmetric(encrypted, vaultKey);
}
