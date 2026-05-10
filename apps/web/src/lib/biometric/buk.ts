import { encryptSymmetric, decryptSymmetric, getSodium } from '@blindpass/crypto';
import type { EncryptedValue } from '@blindpass/types';

/**
 * Wraps MasterKey with the BUK (32-byte secret derived from WebAuthn PRF).
 * Zeroes the BUK after use; the caller relinquishes ownership of the bytes.
 */
export async function wrapMasterKey(
  masterKey: Uint8Array,
  buk: Uint8Array,
): Promise<EncryptedValue> {
  const sodium = await getSodium();
  try {
    return await encryptSymmetric(masterKey, buk);
  } finally {
    sodium.memzero(buk);
  }
}

export async function unwrapMasterKey(
  encrypted: EncryptedValue,
  buk: Uint8Array,
): Promise<Uint8Array> {
  const sodium = await getSodium();
  try {
    return await decryptSymmetric(encrypted, buk);
  } finally {
    sodium.memzero(buk);
  }
}
