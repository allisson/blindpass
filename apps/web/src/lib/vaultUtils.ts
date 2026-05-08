import { decryptVaultMetadata } from '@blindpass/vault';
import { decryptSymmetric, openSealBox } from '@blindpass/crypto';
import type { KeyPair } from '@blindpass/types';
import type { Vault } from '@blindpass/api-schema';
import type { VaultEntry } from './session';
import { fromBase64, fromBase64EncryptedValue } from './b64';

export async function buildVaultsMap(
  serverVaults: Vault[],
  masterKey: Uint8Array,
  keyPair: KeyPair,
): Promise<Map<string, VaultEntry>> {
  const map = new Map<string, VaultEntry>();
  for (const v of serverVaults) {
    const vaultKey = v.isShared
      ? await openSealBox(fromBase64(v.sealedVaultKey!), keyPair)
      : await decryptSymmetric(fromBase64EncryptedValue(v.encryptedVaultKey!), masterKey);
    const metadata = await decryptVaultMetadata(
      fromBase64EncryptedValue(v.encryptedVaultData),
      vaultKey,
    );
    map.set(v.id, {
      vaultKey,
      name: metadata.name,
      isShared: v.isShared,
      role: v.isShared ? v.role : 'owner',
      ownerUsername: v.isShared ? v.ownerUsername : undefined,
      shareId: v.isShared ? v.shareId : undefined,
    });
  }
  return map;
}
