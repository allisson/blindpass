import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FieldError } from '@/components/ui/field-error';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api } from '@/lib/api';
import { authFlow } from '@/lib/authFlow';
import { toBase64 } from '@/lib/b64';

export const Route = createFileRoute('/_auth/recover')({
  component: RecoverPage,
});

const schema = z.object({
  username: z.string().regex(/^[a-z0-9_]{3,32}$/, 'Use 3-32 lowercase letters, numbers, or _'),
  mnemonic: z.string().min(1, 'Recovery phrase is required'),
});

type FormData = z.infer<typeof schema>;

function RecoverPage() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: standardSchemaResolver(schema) });

  async function onSubmit(data: FormData) {
    setError(null);
    try {
      const mnemonic = data.mnemonic.trim().replace(/\s+/g, ' ');
      await api.startRecovery({ username: data.username });
      const recovery = await api.verifyRecovery({
        username: data.username,
        recoveryVerifier: toBase64(new TextEncoder().encode(mnemonic)),
      });
      authFlow.setRecoveryKey(mnemonic);
      authFlow.setRecovery({
        username: data.username,
        recoveryToken: recovery.recoveryToken,
        enrollment: recovery.enrollment,
        bundle: recovery.bundle,
      });
      navigate({ to: '/reset-password' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Recovery failed');
    }
  }

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle>Recover account</CardTitle>
        <CardDescription>
          Enter your username and 24-word recovery phrase. BlindPass will issue a new authenticator
          setup and let you choose a new master password.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" aria-busy={isSubmitting}>
          <div className="field-group" data-invalid={!!errors.username}>
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              autoComplete="username"
              autoFocus
              placeholder="blindpass_user"
              aria-invalid={!!errors.username}
              {...register('username')}
            />
            <FieldError message={errors.username?.message} />
          </div>
          <div className="field-group" data-invalid={!!errors.mnemonic}>
            <Label htmlFor="mnemonic">Recovery phrase</Label>
            <textarea
              id="mnemonic"
              rows={4}
              placeholder="Enter your 24 recovery words, space-separated"
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm font-mono placeholder:text-muted-foreground focus-visible:border-ring resize-none transition-all dark:bg-input/20"
              aria-invalid={!!errors.mnemonic}
              {...register('mnemonic')}
            />
            <FieldError message={errors.mnemonic?.message} />
          </div>
          <FieldError message={error ?? undefined} />
          <Button type="submit" className="w-full" loading={isSubmitting}>
            Continue recovery
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            Remembered it?{' '}
            <a href="/login" className="text-primary hover:underline">
              Sign in
            </a>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
