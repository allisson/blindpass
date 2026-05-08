import { useCallback, useState } from 'react';
import {
  decryptSymmetric,
  encryptSymmetric,
  generateSalt as defaultGenerateSalt,
} from '@blindpass/crypto';
import { api } from '@/lib/api';
import { fromBase64, fromBase64EncryptedValue, toBase64, toBase64EncryptedValue } from '@/lib/b64';
import { deriveKEK as defaultDeriveKEK } from '@/lib/kdfWorker';
import {
  runCeremony,
  type CeremonyError,
  type CeremonyPhase,
  type CeremonyResult,
} from '@/lib/keychain/ceremony';
import { session } from '@/lib/session';

export interface ChangePasswordArgs {
  currentPassword: string;
  newPassword: string;
  authenticatorCode: string;
}

export interface ChangePasswordSuccess {
  ok: true;
}

export interface UseChangePasswordDeps {
  api?: Pick<typeof api, 'getKeys' | 'changePassword'>;
  primitives?: {
    deriveKEK?: typeof defaultDeriveKEK;
    generateSalt?: typeof defaultGenerateSalt;
    decryptSymmetric?: typeof decryptSymmetric;
    encryptSymmetric?: typeof encryptSymmetric;
  };
}

export interface UseChangePasswordReturn {
  phase: CeremonyPhase;
  error: CeremonyError | null;
  changePassword: (args: ChangePasswordArgs) => Promise<CeremonyResult<ChangePasswordSuccess>>;
  reset: () => void;
}

export function useChangePassword(deps: UseChangePasswordDeps = {}): UseChangePasswordReturn {
  /* v8 ignore start */
  const apiImpl = deps.api ?? api;
  const deriveKEK = deps.primitives?.deriveKEK ?? defaultDeriveKEK;
  const generateSalt = deps.primitives?.generateSalt ?? defaultGenerateSalt;
  const decryptImpl = deps.primitives?.decryptSymmetric ?? decryptSymmetric;
  const encryptImpl = deps.primitives?.encryptSymmetric ?? encryptSymmetric;
  /* v8 ignore stop */

  const [phase, setPhase] = useState<CeremonyPhase>('idle');
  const [error, setError] = useState<CeremonyError | null>(null);

  const changePassword = useCallback(
    ({ currentPassword, newPassword, authenticatorCode }: ChangePasswordArgs) =>
      runCeremony<ChangePasswordSuccess>(
        async (ctx) => {
          ctx.setPhase('fetching_keys');
          const keysData = await apiImpl.getKeys();

          ctx.setPhase('deriving_kek');
          const currentKekSalt = fromBase64(keysData.kekSalt);
          const currentKEK = await deriveKEK(currentPassword, currentKekSalt);
          let masterKey: Uint8Array;
          try {
            masterKey = await decryptImpl(
              fromBase64EncryptedValue(keysData.encryptedMasterKey),
              currentKEK,
            );
            ctx.trackForZero(masterKey);
          } finally {
            currentKEK.fill(0);
          }

          const newKekSalt = await generateSalt();
          const newKEK = await deriveKEK(newPassword, newKekSalt);
          let newEncryptedMasterKey: { ciphertext: Uint8Array; nonce: Uint8Array };
          try {
            newEncryptedMasterKey = await encryptImpl(masterKey, newKEK);
          } finally {
            newKEK.fill(0);
          }

          ctx.setPhase('finalizing');
          await apiImpl.changePassword({
            authenticatorCode,
            kekSalt: toBase64(newKekSalt),
            encryptedMasterKey: toBase64EncryptedValue(newEncryptedMasterKey),
          });

          // Force user to sign in again with new password
          session.clear();

          return { ok: true };
        },
        { setPhase, setError },
      ),
    [apiImpl, deriveKEK, generateSalt, decryptImpl, encryptImpl],
  );

  const reset = useCallback(() => {
    setPhase('idle');
    setError(null);
  }, []);

  return { phase, error, changePassword, reset };
}
