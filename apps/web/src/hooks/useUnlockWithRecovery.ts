import { useCallback, useState } from 'react';
import { api } from '@/lib/api';
import { authFlow } from '@/lib/authFlow';
import { fetchAllPages } from '@/lib/fetchAllPages';
import {
  rekey as defaultRekey,
  unlockWithRecovery as defaultUnlockWithRecovery,
} from '@/lib/keychain';
import {
  runCeremony,
  type CeremonyError,
  type CeremonyPhase,
  type CeremonyResult,
} from '@/lib/keychain/ceremony';
import { session } from '@/lib/session';
import { buildVaultsMap as defaultBuildVaultsMap } from '@/lib/vaultUtils';

export interface CompleteRecoverySuccess {
  activeVaultId: string;
}

export interface CompleteRecoveryArgs {
  newPassword: string;
  authenticatorCode: string;
}

export interface UseUnlockWithRecoveryDeps {
  api?: Pick<typeof api, 'getVault' | 'completeRecovery'>;
  primitives?: {
    unlockWithRecovery?: typeof defaultUnlockWithRecovery;
    rekey?: typeof defaultRekey;
    buildVaultsMap?: typeof defaultBuildVaultsMap;
  };
}

export interface UseUnlockWithRecoveryReturn {
  phase: CeremonyPhase;
  error: CeremonyError | null;
  completeRecovery: (
    args: CompleteRecoveryArgs,
  ) => Promise<CeremonyResult<CompleteRecoverySuccess>>;
  reset: () => void;
}

export function useUnlockWithRecovery(
  deps: UseUnlockWithRecoveryDeps = {},
): UseUnlockWithRecoveryReturn {
  /* v8 ignore start */
  const apiImpl = deps.api ?? api;
  const unlockImpl = deps.primitives?.unlockWithRecovery ?? defaultUnlockWithRecovery;
  const rekeyImpl = deps.primitives?.rekey ?? defaultRekey;
  const buildMapImpl = deps.primitives?.buildVaultsMap ?? defaultBuildVaultsMap;
  /* v8 ignore stop */

  const [phase, setPhase] = useState<CeremonyPhase>('idle');
  const [error, setError] = useState<CeremonyError | null>(null);

  const completeRecovery = useCallback(
    ({ newPassword, authenticatorCode }: CompleteRecoveryArgs) =>
      runCeremony<CompleteRecoverySuccess>(
        async (ctx) => {
          const recovery = authFlow.getRecovery();
          const recoveryPhrase = authFlow.getRecoveryKey();
          if (!recovery || !recoveryPhrase) throw new Error('Recovery context missing.');

          const { bundle } = recovery;

          ctx.setPhase('decrypting');
          const { masterKey, keyPair } = await unlockImpl(recoveryPhrase, bundle);
          ctx.trackForZero(masterKey);
          ctx.trackForZero(keyPair.privateKey);

          ctx.setPhase('deriving_kek');
          const re = await rekeyImpl(masterKey, newPassword);

          await apiImpl.completeRecovery({
            username: recovery.username,
            recoveryToken: recovery.recoveryToken,
            enrollmentId: recovery.enrollment.enrollmentId,
            authenticatorCode,
            kekSalt: re.kekSalt,
            publicKey: bundle.publicKey,
            encryptedMasterKey: re.encryptedMasterKey,
            encryptedMasterKeyForRecovery: re.encryptedMasterKeyForRecovery,
            encryptedPrivateKey: bundle.encryptedPrivateKey,
            encryptedRecoveryKey: re.encryptedRecoveryKey,
            recoveryVerifier: re.recoveryVerifier,
          });

          ctx.setPhase('finalizing');
          const vaults = await fetchAllPages((cursor) =>
            apiImpl.getVault(cursor).then((r) => ({ data: r.vaults, nextCursor: r.nextCursor })),
          );
          const ownedVault = vaults.find((v) => !v.isShared);
          if (!ownedVault) throw new Error('No vault found.');

          const vaultsMap = await buildMapImpl(vaults, masterKey, keyPair);
          for (const v of vaultsMap.values()) ctx.trackForZero(v.vaultKey);

          const activeVaultId = ownedVault.id;
          const activeVault = vaultsMap.get(activeVaultId);
          if (!activeVault) throw new Error('Recovered vault missing from session');

          authFlow.clearRecovery();
          authFlow.setRecoveryKey(re.newRecoveryKey);
          authFlow.setPendingSession({
            username: recovery.username,
            activeVaultId,
            vaults: vaultsMap,
            keychain: { masterKey, vaultKey: activeVault.vaultKey },
            keyPair,
          });
          // Set session without keychain — keychain is gated by /recovery-key reveal
          session.set({
            username: recovery.username,
            activeVaultId,
            vaults: vaultsMap,
            keychain: null,
            keyPair,
          });
          // Pending session owns key references now
          ctx.releaseTrackedKeys();

          return { activeVaultId };
        },
        { setPhase, setError },
      ),
    [apiImpl, unlockImpl, rekeyImpl, buildMapImpl],
  );

  const reset = useCallback(() => {
    setPhase('idle');
    setError(null);
  }, []);

  return { phase, error, completeRecovery, reset };
}
