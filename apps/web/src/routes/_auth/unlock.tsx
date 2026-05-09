import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { Lock, LockOpen } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FieldError } from '@/components/ui/field-error';
import { Label } from '@/components/ui/label';
import { PasswordInput } from '@/components/ui/password-input';
import { api } from '@/lib/api';
import { CEREMONY_PHASE_LABEL } from '@/lib/keychain/ceremony';
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
  const restoreUsername = isRestore ? getLastUsername() : null;
  const ceremony = useUnlockWithPassword();
  const loadingMsg = CEREMONY_PHASE_LABEL[ceremony.phase];
  const isRunning =
    ceremony.phase !== 'idle' && ceremony.phase !== 'error' && ceremony.phase !== 'done';

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: standardSchemaResolver(schema) });

  const busy = isRunning || isSubmitting;

  async function onSubmit(data: FormData) {
    const result = await ceremony.unlock(data.password);
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
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" aria-busy={busy}>
          <div className="field-group" data-invalid={!!errors.password}>
            <Label htmlFor="password">Master password</Label>
            <PasswordInput
              id="password"
              autoComplete="current-password"
              autoFocus
              disabled={busy}
              aria-invalid={!!errors.password}
              {...register('password')}
            />
            <FieldError message={errors.password?.message} />
          </div>
          <FieldError message={ceremony.error?.message} data-testid="error-message" />
          <Button type="submit" className="w-full" loading={busy} disabled={busy}>
            {loadingMsg || (isSubmitting ? 'Unlocking…' : 'Unlock vault')}
          </Button>
          <div className="flex flex-col items-center gap-2 pt-1 text-center">
            <p className="text-[11px] text-muted-foreground/80">Decryption runs on this device.</p>
            <button
              type="button"
              onClick={handleSignOut}
              className="text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              Sign out instead
            </button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
