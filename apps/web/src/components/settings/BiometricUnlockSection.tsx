import { Check, Fingerprint } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useBiometricEnrollment } from '@/hooks/useBiometricEnrollment';
import { getBiometricLabel } from '@/lib/biometric';
import { session } from '@/lib/session';

const REASON_COPY: Record<string, string> = {
  no_webauthn: 'This browser does not support WebAuthn.',
  no_platform_authenticator:
    'No platform authenticator (Touch ID, Face ID, Windows Hello, or Android biometric) is configured on this device.',
  prf_unsupported:
    'This browser supports WebAuthn but not the PRF extension required for biometric unlock.',
};

export function BiometricUnlockSection() {
  const { phase, error, support, isEnrolled, enroll, disenroll } = useBiometricEnrollment();
  const label = getBiometricLabel();
  const isUnlocked = !!session.get()?.keychain;
  const busy = phase === 'enrolling' || phase === 'disenrolling' || phase === 'probing';

  if (support === null || phase === 'probing') {
    return <p className="text-sm text-muted-foreground">Checking device support…</p>;
  }

  if (!support.supported) {
    return (
      <p className="text-sm text-muted-foreground">
        {REASON_COPY[support.reason] ??
          'Biometric unlock isn’t available on this browser or device.'}
      </p>
    );
  }

  if (isEnrolled) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-primary/10 border border-primary/20 text-primary">
            <Check className="w-3 h-3" />
            Enrolled on this device
          </span>
        </div>
        <Button size="sm" variant="outline" onClick={() => void disenroll()} disabled={busy}>
          Remove biometric unlock
        </Button>
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {!isUnlocked ? (
        <p className="text-xs text-muted-foreground">
          Unlock your vault with your master password before enrolling.
        </p>
      ) : null}
      <Button
        size="sm"
        variant="outline"
        onClick={() => void enroll()}
        disabled={!isUnlocked || busy}
      >
        <Fingerprint className="w-3.5 h-3.5 mr-1.5" />
        Enable {label}
      </Button>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
