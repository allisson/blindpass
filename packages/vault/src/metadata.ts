import type { EncryptedValue } from '@blindpass/types';
import { encryptSymmetric, decryptSymmetric } from '@blindpass/crypto';

export type VaultMetadata = { name: string };

export async function encryptVaultMetadata(
  metadata: VaultMetadata,
  vaultKey: Uint8Array,
): Promise<EncryptedValue> {
  const plaintext = new TextEncoder().encode(JSON.stringify(metadata));
  return encryptSymmetric(plaintext, vaultKey);
}

export async function decryptVaultMetadata(
  blob: EncryptedValue,
  vaultKey: Uint8Array,
): Promise<VaultMetadata> {
  const bytes = await decryptSymmetric(blob, vaultKey);
  return JSON.parse(new TextDecoder().decode(bytes)) as VaultMetadata;
}
