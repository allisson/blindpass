import { useCallback, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { fetchAllPages } from '@/lib/fetchAllPages';
import { unlockWithBiometric as defaultUnlock } from '@/lib/keychain';
import {
  runCeremony,
  type CeremonyError,
  type CeremonyPhase,
  type CeremonyResult,
} from '@/lib/keychain/ceremony';
import { getLastUsername, session } from '@/lib/session';
import { buildVaultsMap as defaultBuildVaultsMap } from '@/lib/vaultUtils';
import { enrollmentStore } from '@/lib/biometric';

export interface BiometricUnlockSuccess {
  activeVaultId: string;
}

export interface UseBiometricUnlockDeps {
  api?: Pick<typeof api, 'getKeys' | 'getVault' | 'getBiometricCredential'>;
  primitives?: {
    unlockWithBiometric?: typeof defaultUnlock;
    buildVaultsMap?: typeof defaultBuildVaultsMap;
  };
}

export interface UseBiometricUnlockReturn {
  phase: CeremonyPhase;
  error: CeremonyError | null;
  unlock: () => Promise<CeremonyResult<BiometricUnlockSuccess>>;
  reset: () => void;
}

export function useBiometricUnlock(deps: UseBiometricUnlockDeps = {}): UseBiometricUnlockReturn {
  /* v8 ignore start */
  const apiImpl = deps.api ?? api;
  const unlockImpl = deps.primitives?.unlockWithBiometric ?? defaultUnlock;
  const buildMapImpl = deps.primitives?.buildVaultsMap ?? defaultBuildVaultsMap;
  /* v8 ignore stop */

  const [phase, setPhase] = useState<CeremonyPhase>('idle');
  const [error, setError] = useState<CeremonyError | null>(null);

  const unlock = useCallback(
    () =>
      runCeremony<BiometricUnlockSuccess>(
        async (ctx) => {
          ctx.setPhase('fetching_keys');
          const sBefore = session.get();
          const username = sBefore?.username ?? getLastUsername();
          if (!username) throw new Error('No username on this device.');

          const enrollment = await enrollmentStore.get(username);
          if (!enrollment)
            throw new Error('No biometric enrollment for this account on this device.');

          const credentialCheckPromise = enrollment.serverCredentialId
            ? apiImpl
                .getBiometricCredential(enrollment.serverCredentialId)
                .then(() => true as const)
                .catch((e: unknown) => {
                  if (e instanceof ApiError && e.status === 404) return null;
                  throw e;
                })
            : Promise.resolve(true as const); // enrollments without serverCredentialId pre-date server tracking; skip the check

          const [keysData, vaults, credentialValid] = await Promise.all([
            apiImpl.getKeys(),
            fetchAllPages((cursor) =>
              apiImpl.getVault(cursor).then((r) => ({
                data: r.vaults,
                nextCursor: r.nextCursor,
              })),
            ),
            credentialCheckPromise,
          ]);

          if (credentialValid === null) {
            await enrollmentStore.delete(username);
            const revoked = new Error(
              'Biometric unlock was revoked from another device. Please sign in with your password.',
            );
            revoked.name = 'CredentialRevokedError';
            throw revoked;
          }

          const ownedVault = vaults.find((v) => !v.isShared);
          if (!ownedVault) throw new Error('No vault found.');

          ctx.setPhase('decrypting');
          const unlocked = await unlockImpl(enrollment, keysData);
          ctx.trackForZero(unlocked.masterKey);
          ctx.trackForZero(unlocked.keyPair.privateKey);

          ctx.setPhase('finalizing');
          const vaultsMap = await buildMapImpl(vaults, unlocked.masterKey, unlocked.keyPair);
          for (const v of vaultsMap.values()) ctx.trackForZero(v.vaultKey);

          const activeVaultId = ownedVault.id;
          const activeVault = vaultsMap.get(activeVaultId);
          if (!activeVault) throw new Error('Active vault missing from session map');

          session.set({
            username,
            activeVaultId,
            vaults: vaultsMap,
            keychain: { masterKey: unlocked.masterKey, vaultKey: activeVault.vaultKey },
            keyPair: unlocked.keyPair,
          });
          ctx.releaseTrackedKeys();

          return { activeVaultId };
        },
        { setPhase, setError },
      ),
    [apiImpl, unlockImpl, buildMapImpl],
  );

  const reset = useCallback(() => {
    setPhase('idle');
    setError(null);
  }, []);

  return { phase, error, unlock, reset };
}
