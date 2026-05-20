import { decryptSymmetric, type EncryptedValue } from '@blindpass/crypto';
import { VaultItemSchema, type VaultItem } from './schema.js';

export async function decryptVaultItem(
  blob: EncryptedValue,
  itemKey: Uint8Array,
): Promise<VaultItem> {
  const bytes = await decryptSymmetric(blob, itemKey);
  const json = new TextDecoder().decode(bytes);
  const data = JSON.parse(json);
  if (!data.type) data.type = 'login';
  return VaultItemSchema.parse(data);
}
