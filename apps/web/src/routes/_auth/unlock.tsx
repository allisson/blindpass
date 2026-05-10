import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { Fingerprint, Lock, LockOpen } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FieldError } from '@/components/ui/field-error';
import { Label } from '@/components/ui/label';
import { PasswordInput } from '@/components/ui/password-input';
import { api } from '@/lib/api';
import { enrollmentStore, getBiometricLabel } from '@/lib/biometric';
import { CEREMONY_PHASE_LABEL } from '@/lib/keychain/ceremony';
import { useBiometricUnlock } from '@/hooks/useBiometricUnlock';
import { useUnlockWithPassword } from '@/hooks/useUnlockWithPassword';
import { session, getLastUsername, clearLastUsername } from '@/lib/session';
import { vaultCache } from '@/lib/vaultCache';

export const Route = createFileRoute('/_auth/unlock')({
  component: UnlockPage,
});

const schema = z.object({
  password: z.string().min(1, 'Password is required'),
});

type FormData = z.infer<typeof schema>;

function UnlockPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const isRestore = !session.get();
  const restoreUsername =
    (session.get()?.username ?? null) || (isRestore ? getLastUsername() : null);
  const passwordCeremony = useUnlockWithPassword();
  const biometricCeremony = useBiometricUnlock();

  const [biometricEnrolled, setBiometricEnrolled] = useState<boolean | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const biometricLabel = getBiometricLabel();

  useEffect(() => {
    let cancelled = false;
    const username = session.get()?.username ?? getLastUsername();
    if (!username) {
      setBiometricEnrolled(false);
      return;
    }
    void enrollmentStore
      .get(username)
      .then((rec) => {
        if (cancelled) return;
        setBiometricEnrolled(!!rec);
      })
      .catch(() => {
        /* c8 ignore next */
        if (!cancelled) setBiometricEnrolled(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const activeCeremony =
    biometricCeremony.phase !== 'idle' && biometricCeremony.phase !== 'error'
      ? biometricCeremony
      : passwordCeremony;
  const loadingMsg = CEREMONY_PHASE_LABEL[activeCeremony.phase];
  const isRunning =
    activeCeremony.phase !== 'idle' &&
    activeCeremony.phase !== 'error' &&
    activeCeremony.phase !== 'done';

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: standardSchemaResolver(schema) });

  const busy = isRunning || isSubmitting;

  async function onSubmit(data: FormData) {
    const result = await passwordCeremony.unlock(data.password);
    if (result.ok) {
      navigate({ to: '/' });
      return;
    }
    if (result.error.code === 'session_expired') {
      session.clear();
      await vaultCache.clearAll().catch(() => {});
      qc.clear();
      navigate({ to: '/login' });
    }
  }

  async function handleBiometric() {
    biometricCeremony.reset();
    const result = await biometricCeremony.unlock();
    if (result.ok) {
      navigate({ to: '/' });
      return;
    }
    if (result.error.code === 'session_expired') {
      session.clear();
      await vaultCache.clearAll().catch(() => {});
      qc.clear();
      navigate({ to: '/login' });
      return;
    }
    if (result.error.code === 'biometric_failed') {
      // Credential no longer recognised by the OS — drop local enrollment so
      // the next /unlock visit shows password-only.
      const username = session.get()?.username ?? getLastUsername();
      if (username) await enrollmentStore.delete(username).catch(() => {});
      setBiometricEnrolled(false);
      setShowPassword(true);
      return;
    }
    if (result.error.code === 'biometric_cancelled') {
      // Quietly reset; password fallback stays available.
      biometricCeremony.reset();
      return;
    }
    // Other errors: keep biometric option, but reveal password fallback.
    setShowPassword(true);
  }

  async function handleSignOut() {
    try {
      await api.logout();
    } catch {
      // best-effort — server session may already be gone
    }
    session.clear();
    clearLastUsername();
    await vaultCache.clearAll().catch(() => {});
    qc.clear();
    navigate({ to: '/login' });
  }

  const showBiometric = biometricEnrolled === true;
  const showPasswordForm = !showBiometric || showPassword;

  return (
    <Card className="glass-card">
      <CardHeader>
        <div
          className="unlock-icon-frame mb-3 inline-flex h-9 w-9 items-center justify-center rounded-xl border"
          data-state={busy ? 'run' : 'rest'}
          aria-hidden="true"
        >
          {busy ? (
            <LockOpen className="h-4 w-4 text-foreground" />
          ) : (
            <Lock className="h-4 w-4 text-foreground" />
          )}
        </div>
        <CardTitle>Vault locked</CardTitle>
        <CardDescription>
          {isRestore && restoreUsername ? `Resume as ${restoreUsername}` : 'Session active'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {showBiometric ? (
          <div className="space-y-3" aria-busy={busy}>
            <Button
              type="button"
              className="w-full"
              loading={biometricCeremony.phase !== 'idle' && busy}
              disabled={busy}
              onClick={() => void handleBiometric()}
            >
              <Fingerprint className="mr-1.5 h-4 w-4" aria-hidden="true" />
              {biometricCeremony.phase !== 'idle' && busy
                ? loadingMsg || `Waiting for ${biometricLabel}…`
                : `Unlock with ${biometricLabel}`}
            </Button>
            <FieldError
              message={biometricCeremony.error?.message}
              data-testid="biometric-error-message"
            />
            {!showPassword ? (
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => setShowPassword(true)}
                  className="text-xs text-muted-foreground transition-colors hover:text-foreground"
                >
                  Use password instead
                </button>
              </div>
            ) : null}
          </div>
        ) : null}

        {showPasswordForm ? (
          <form
            onSubmit={handleSubmit(onSubmit)}
            className={`space-y-4 ${showBiometric ? 'mt-5 border-t border-border/60 pt-5' : ''}`}
            aria-busy={busy}
          >
            <div className="field-group" data-invalid={!!errors.password}>
              <Label htmlFor="password">Master password</Label>
              <PasswordInput
                id="password"
                autoComplete="current-password"
                autoFocus={!showBiometric}
                disabled={busy}
                aria-invalid={!!errors.password}
                {...register('password')}
              />
              <FieldError message={errors.password?.message} />
            </div>
            <FieldError message={passwordCeremony.error?.message} data-testid="error-message" />
            <Button type="submit" className="w-full" loading={busy} disabled={busy}>
              {passwordCeremony.phase !== 'idle' && busy
                ? loadingMsg || (isSubmitting ? 'Unlocking…' : 'Unlock vault')
                : 'Unlock vault'}
            </Button>
          </form>
        ) : null}

        <div className="mt-4 flex flex-col items-center gap-2 pt-1 text-center">
          <p className="text-[11px] text-muted-foreground/80">Decryption runs on this device.</p>
          <button
            type="button"
            onClick={handleSignOut}
            className="text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            Sign out instead
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
