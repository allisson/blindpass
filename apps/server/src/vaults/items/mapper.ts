import { toB64 } from '../../utils/base64.js';
import type { VersionedItemRow } from './repository.js';

export function toEncryptedVaultItem(i: VersionedItemRow) {
  return {
    id: i.id,
    folderId: i.folderId,
    encryptedData: {
      ciphertext: toB64(i.encryptedDataCiphertext),
      nonce: toB64(i.encryptedDataNonce),
    },
    encryptedItemKey: {
      ciphertext: toB64(i.encryptedItemKeyCiphertext),
      nonce: toB64(i.encryptedItemKeyNonce),
    },
    createdAt: i.createdAt.toISOString(),
    updatedAt: i.updatedAt.toISOString(),
  };
}
