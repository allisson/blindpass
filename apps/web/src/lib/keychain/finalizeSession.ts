import type { Vault } from '@blindpass/api-schema';
import type { KeyPair } from '@blindpass/crypto';
import type { VaultEntry } from '../session.js';
import type { CeremonyContext } from './ceremony.js';

export async function finalizeUnlockSession(
  ctx: CeremonyContext,
  {
    masterKey,
    keyPair,
    vaults,
    buildVaultsMap,
    commitSession,
  }: {
    masterKey: Uint8Array;
    keyPair: KeyPair;
    vaults: Vault[];
    buildVaultsMap: (
      vaults: Vault[],
      masterKey: Uint8Array,
      keyPair: KeyPair,
    ) => Promise<Map<string, VaultEntry>>;
    commitSession: (
      activeVaultId: string,
      vaultsMap: Map<string, VaultEntry>,
      activeVault: VaultEntry,
    ) => void;
  },
): Promise<{ activeVaultId: string }> {
  const ownedVault = vaults.find((v) => !v.isShared);
  if (!ownedVault) throw new Error('No vault found.');

  const vaultsMap = await buildVaultsMap(vaults, masterKey, keyPair);
  for (const v of vaultsMap.values()) ctx.trackForZero(v.vaultKey);

  const activeVaultId = ownedVault.id;
  const activeVault = vaultsMap.get(activeVaultId);
  if (!activeVault) throw new Error('Active vault missing from session map');

  commitSession(activeVaultId, vaultsMap, activeVault);
  ctx.releaseTrackedKeys();
  return { activeVaultId };
}
