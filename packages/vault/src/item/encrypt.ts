import type { EncryptedValue } from '@blindpass/types';
import { encryptSymmetric } from '@blindpass/crypto';
import type { VaultItem } from './schema.js';

export async function encryptVaultItem(
  item: VaultItem,
  itemKey: Uint8Array,
): Promise<EncryptedValue> {
  const plaintext = new TextEncoder().encode(JSON.stringify(item));
  return encryptSymmetric(plaintext, itemKey);
}
