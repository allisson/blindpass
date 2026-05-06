import { sealBox, openSealBox } from '@blindpass/crypto';
import type { KeyPair } from '@blindpass/types';

export async function encryptVaultKeyForSharing(
  vaultKey: Uint8Array,
  receiverPublicKey: Uint8Array,
): Promise<Uint8Array> {
  return sealBox(vaultKey, receiverPublicKey);
}

export async function decryptSharedVaultKey(
  sealedKey: Uint8Array,
  keyPair: KeyPair,
): Promise<Uint8Array> {
  return openSealBox(sealedKey, keyPair);
}
