import { useCallback, useState } from 'react';
import { api } from '@/lib/api';
import { fetchAllPages } from '@/lib/fetchAllPages';
import { unlockWithPassword as defaultUnlock } from '@/lib/keychain';
import {
  runCeremony,
  type CeremonyError,
  type CeremonyPhase,
  type CeremonyResult,
} from '@/lib/keychain/ceremony';
import { finalizeUnlockSession } from '@/lib/keychain/finalizeSession';
import { getLastUsername, session } from '@/lib/session';
import { buildVaultsMap as defaultBuildVaultsMap } from '@/lib/vaultUtils';

export interface UnlockWithPasswordSuccess {
  activeVaultId: string;
}

export interface UnlockWithPasswordDeps {
  api?: Pick<typeof api, 'getKeys' | 'getVault'>;
  primitives?: {
    unlockWithPassword?: typeof defaultUnlock;
    buildVaultsMap?: typeof defaultBuildVaultsMap;
  };
}

export interface UseUnlockWithPasswordReturn {
  phase: CeremonyPhase;
  error: CeremonyError | null;
  unlock: (password: string) => Promise<CeremonyResult<UnlockWithPasswordSuccess>>;
  reset: () => void;
}

export function useUnlockWithPassword(
  deps: UnlockWithPasswordDeps = {},
): UseUnlockWithPasswordReturn {
  /* v8 ignore start */
  const apiImpl = deps.api ?? api;
  const unlockImpl = deps.primitives?.unlockWithPassword ?? defaultUnlock;
  const buildMapImpl = deps.primitives?.buildVaultsMap ?? defaultBuildVaultsMap;
  /* v8 ignore stop */

  const [phase, setPhase] = useState<CeremonyPhase>('idle');
  const [error, setError] = useState<CeremonyError | null>(null);

  const unlock = useCallback(
    (password: string) =>
      runCeremony<UnlockWithPasswordSuccess>(
        async (ctx) => {
          ctx.setPhase('fetching_keys');
          const sBefore = session.get();
          const [keysData, vaults] = await Promise.all([
            apiImpl.getKeys(),
            fetchAllPages((cursor) =>
              apiImpl.getVault(cursor).then((r) => ({
                data: r.vaults,
                nextCursor: r.nextCursor,
              })),
            ),
          ]);

          if (!vaults.some((v) => !v.isShared)) throw new Error('No vault found.');

          ctx.setPhase('decrypting');
          const unlocked = await unlockImpl(password, keysData);
          ctx.trackForZero(unlocked.masterKey);
          ctx.trackForZero(unlocked.keyPair.privateKey);

          ctx.setPhase('finalizing');
          const username = sBefore?.username ?? getLastUsername() ?? undefined;
          return finalizeUnlockSession(ctx, {
            masterKey: unlocked.masterKey,
            keyPair: unlocked.keyPair,
            vaults,
            buildVaultsMap: buildMapImpl,
            commitSession: (activeVaultId, vaultsMap, activeVault) => {
              session.set({
                username,
                activeVaultId,
                vaults: vaultsMap,
                keychain: { masterKey: unlocked.masterKey, vaultKey: activeVault.vaultKey },
                keyPair: unlocked.keyPair,
              });
            },
          });
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
