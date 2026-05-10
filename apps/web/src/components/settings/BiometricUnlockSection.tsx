import { AlertTriangle, Check, Fingerprint } from 'lucide-react';
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
  const { phase, error, support, isEnrolled, enroll, disenroll, reset } = useBiometricEnrollment();
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
        {error?.kind === 'unknown' ? (
          <p className="text-xs text-destructive">{error.message}</p>
        ) : null}
      </div>
    );
  }

  if (error?.kind === 'prf-not-enabled') {
    return (
      <div className="space-y-3">
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-destructive">
            <AlertTriangle className="w-4 h-4" />
            Biometric unlock needs Google Password Manager
          </div>
          <p className="text-xs text-muted-foreground">
            Your password manager saved the passkey, but doesn’t expose the cryptographic feature
            (WebAuthn PRF) BlindPass needs to derive the unlock key. On Android only{' '}
            <strong>Google Password Manager</strong> supports this today; on iOS you need Safari 18
            or later.
          </p>
          <p className="text-xs text-muted-foreground">
            <strong>What to do:</strong> delete the saved passkey from your password manager, then
            try again and pick <strong>Google</strong> when Android asks where to save it.
          </p>
          <p className="text-xs text-muted-foreground">
            Master password works as before — biometric unlock is optional.
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => void enroll()} disabled={busy}>
            <Fingerprint className="w-3.5 h-3.5 mr-1.5" />
            Try again
          </Button>
          <Button size="sm" variant="ghost" onClick={reset} disabled={busy}>
            Dismiss
          </Button>
        </div>
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
      {error?.kind === 'unknown' ? (
        <p className="text-xs text-destructive">{error.message}</p>
      ) : null}
    </div>
  );
}
