import { useCallback, useEffect, useState } from 'react';
import { generateKey } from '@blindpass/crypto';
import {
  enrollmentStore,
  ENROLLMENT_VERSION,
  getBiometricLabel,
  PrfNotEnabledError,
  probePrfSupport,
  registerBiometric,
  type BiometricEnrollment,
  type PrfSupport,
} from '@/lib/biometric';
import { wrapMasterKey } from '@/lib/biometric/buk';
import { api } from '@/lib/api';
import { getLastUsername, session } from '@/lib/session';
import { toBase64 } from '@/lib/b64';

export type EnrollmentPhase = 'idle' | 'probing' | 'enrolling' | 'disenrolling' | 'done' | 'error';

export type EnrollmentError = { kind: 'prf-not-enabled' } | { kind: 'unknown'; message: string };

export interface UseBiometricEnrollmentReturn {
  phase: EnrollmentPhase;
  error: EnrollmentError | null;
  support: PrfSupport | null;
  isEnrolled: boolean;
  enroll: () => Promise<void>;
  disenroll: () => Promise<void>;
  reset: () => void;
}

function rpIdFromOrigin(): string {
  /* v8 ignore start */
  if (typeof window === 'undefined') return 'localhost';
  return window.location.hostname;
  /* v8 ignore stop */
}

export function useBiometricEnrollment(): UseBiometricEnrollmentReturn {
  const [phase, setPhase] = useState<EnrollmentPhase>('idle');
  const [error, setError] = useState<EnrollmentError | null>(null);
  const [support, setSupport] = useState<PrfSupport | null>(null);
  const [isEnrolled, setIsEnrolled] = useState(false);

  const refresh = useCallback(async () => {
    const username = session.get()?.username ?? getLastUsername();
    if (!username) {
      setIsEnrolled(false);
      return;
    }
    const record = await enrollmentStore.get(username);
    setIsEnrolled(!!record);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setPhase('probing');
    void Promise.all([probePrfSupport(), refresh()])
      .then(([s]) => {
        if (cancelled) return;
        setSupport(s);
        setPhase('idle');
      })
      .catch((err: unknown) => {
        /* c8 ignore start */
        if (cancelled) return;
        setSupport({ supported: false, reason: 'no_webauthn' });
        setError({
          kind: 'unknown',
          message: err instanceof Error ? err.message : 'Capability probe failed.',
        });
        setPhase('error');
        /* c8 ignore stop */
      });
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  const enroll = useCallback(async () => {
    setError(null);
    setPhase('enrolling');
    try {
      const s = session.get();
      const masterKey = s?.keychain?.masterKey;
      const username = s?.username ?? getLastUsername();
      if (!masterKey || !username) {
        throw new Error('Vault must be unlocked to enroll biometric unlock.');
      }
      if (!support?.supported) {
        throw new Error('Biometric unlock is not available on this device.');
      }

      const prfSalt = await generateKey(); // 32 bytes
      const userId = new TextEncoder().encode(username);
      const rpId = rpIdFromOrigin();

      const { credentialId, prfOutput } = await registerBiometric({
        rpId,
        rpName: 'BlindPass',
        username,
        userId,
        prfSalt,
      });

      const encryptedMasterKey = await wrapMasterKey(masterKey, prfOutput);

      const label = getBiometricLabel();
      const serverRes = await api.registerBiometricCredential({
        credentialId: toBase64(credentialId),
        label: label ?? undefined,
      });

      const record: BiometricEnrollment = {
        version: ENROLLMENT_VERSION,
        username,
        credentialId,
        prfSalt,
        encryptedMasterKey,
        rpId,
        createdAt: new Date().toISOString(),
        label: label ?? undefined,
        serverCredentialId: serverRes.id,
      };
      await enrollmentStore.put(record);
      setIsEnrolled(true);
      setPhase('done');
    } catch (err: unknown) {
      if (err instanceof PrfNotEnabledError) {
        setError({ kind: 'prf-not-enabled' });
      } else {
        const msg = err instanceof Error ? err.message : 'Enrollment failed.';
        setError({ kind: 'unknown', message: msg });
      }
      setPhase('error');
    }
  }, [support]);

  const disenroll = useCallback(async () => {
    setError(null);
    setPhase('disenrolling');
    try {
      const username = session.get()?.username ?? getLastUsername();
      if (username) {
        const enrollment = await enrollmentStore.get(username);
        if (enrollment?.serverCredentialId) {
          void api.deleteBiometricCredential(enrollment.serverCredentialId).catch(() => {});
        }
        await enrollmentStore.delete(username);
      }
      setIsEnrolled(false);
      setPhase('done');
    } catch (err: unknown) {
      /* c8 ignore start */
      const msg = err instanceof Error ? err.message : 'Disenrollment failed.';
      setError({ kind: 'unknown', message: msg });
      setPhase('error');
      /* c8 ignore stop */
    }
  }, []);

  const reset = useCallback(() => {
    setPhase('idle');
    setError(null);
  }, []);

  return { phase, error, support, isEnrolled, enroll, disenroll, reset };
}
