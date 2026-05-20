import { encryptSymmetric, decryptSymmetric, type EncryptedValue } from '@blindpass/crypto';

export async function encryptFolderName(
  name: string,
  vaultKey: Uint8Array,
): Promise<EncryptedValue> {
  const plaintext = new TextEncoder().encode(name);
  return encryptSymmetric(plaintext, vaultKey);
}

export async function decryptFolderName(
  blob: EncryptedValue,
  vaultKey: Uint8Array,
): Promise<string> {
  const bytes = await decryptSymmetric(blob, vaultKey);
  return new TextDecoder().decode(bytes);
}
