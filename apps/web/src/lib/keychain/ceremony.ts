import { ApiError } from '@/lib/api';

export type CeremonyPhase =
  | 'idle'
  | 'fetching_keys'
  | 'deriving_kek'
  | 'decrypting'
  | 'finalizing'
  | 'done'
  | 'error';

export type CeremonyErrorCode =
  | 'wrong_password'
  | 'session_expired'
  | 'network'
  | 'no_vault'
  | 'kdf_failed'
  | 'biometric_failed'
  | 'biometric_cancelled'
  | 'unknown';

export interface CeremonyError {
  code: CeremonyErrorCode;
  message: string;
  cause?: unknown;
}

export type CeremonyResult<T> = { ok: true; value: T } | { ok: false; error: CeremonyError };

export const CEREMONY_PHASE_LABEL: Record<CeremonyPhase, string> = {
  idle: '',
  fetching_keys: 'Fetching keys…',
  deriving_kek: 'Deriving encryption key…',
  decrypting: 'Decrypting vault…',
  finalizing: 'Restoring session…',
  done: 'Done',
  error: '',
};

export interface CeremonyContext {
  setPhase(p: CeremonyPhase): void;
  trackForZero<T extends Uint8Array>(k: T): T;
  releaseTrackedKeys(): void;
}

export interface CeremonyHooks {
  setPhase(p: CeremonyPhase): void;
  setError(e: CeremonyError | null): void;
}

export async function runCeremony<T>(
  steps: (ctx: CeremonyContext) => Promise<T>,
  hooks: CeremonyHooks,
): Promise<CeremonyResult<T>> {
  const tracked: Uint8Array[] = [];
  const ctx: CeremonyContext = {
    setPhase: hooks.setPhase,
    trackForZero(k) {
      tracked.push(k);
      return k;
    },
    releaseTrackedKeys() {
      tracked.length = 0;
    },
  };
  hooks.setError(null);
  hooks.setPhase('idle');
  try {
    const value = await steps(ctx);
    hooks.setPhase('done');
    return { ok: true, value };
  } catch (err) {
    for (const k of tracked) k.fill(0);
    const ce = mapCeremonyError(err);
    hooks.setError(ce);
    hooks.setPhase('error');
    return { ok: false, error: ce };
  }
}

export function mapCeremonyError(err: unknown): CeremonyError {
  if (err instanceof ApiError) {
    if (err.status === 401)
      return { code: 'session_expired', message: 'Sign in required.', cause: err };
    return { code: 'network', message: err.message, cause: err };
  }
  if (err instanceof Error) {
    if (err.name === 'NotAllowedError')
      return {
        code: 'biometric_cancelled',
        message: 'Biometric prompt cancelled.',
        cause: err,
      };
    if (err.name === 'InvalidStateError')
      return {
        code: 'biometric_failed',
        message: 'Biometric no longer recognised on this device.',
        cause: err,
      };
    const m = err.message.toLowerCase();
    if (m.includes('mac') || m.includes('ciphertext') || m.includes('wrong password'))
      return {
        code: 'wrong_password',
        message: 'Incorrect password or recovery phrase.',
        cause: err,
      };
    if (m.includes('no vault')) return { code: 'no_vault', message: 'No vault found.', cause: err };
    if (m.includes('kdf') || m.includes('argon'))
      return { code: 'kdf_failed', message: 'Key derivation failed.', cause: err };
    if (m.includes('prf') || m.includes('biometric'))
      return {
        code: 'biometric_failed',
        message: err.message,
        cause: err,
      };
    return { code: 'unknown', message: err.message, cause: err };
  }
  return { code: 'unknown', message: 'Unknown error', cause: err };
}
