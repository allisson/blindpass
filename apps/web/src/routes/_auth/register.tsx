import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FieldError } from '@/components/ui/field-error';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PasswordInput } from '@/components/ui/password-input';
import { PasswordStrength } from '@/components/ui/password-strength';
import { PassphraseGenerator } from '@/components/ui/passphrase-generator';
import { loadZxcvbn } from '@/lib/zxcvbn';
import { api } from '@/lib/api';
import { authFlow } from '@/lib/authFlow';
import { bootstrap } from '@/lib/keychain';
import { MIN_PASSWORD_LENGTH } from '@/lib/constants';

export const Route = createFileRoute('/_auth/register')({
  component: RegisterPage,
});

const schema = z
  .object({
    username: z.string().regex(/^[a-z0-9_]{3,32}$/, 'Use 3-32 lowercase letters, numbers, or _'),
    password: z.string().min(MIN_PASSWORD_LENGTH, `At least ${MIN_PASSWORD_LENGTH} characters`),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type FormData = z.infer<typeof schema>;

const MIN_STRENGTH_SCORE = 3;

function RegisterPage() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [loadingMsg, setLoadingMsg] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormData>({ resolver: standardSchemaResolver(schema) });

  const passwordValue = watch('password', '');
  const usernameValue = watch('username', '');

  async function onSubmit(data: FormData) {
    setError(null);
    try {
      setLoadingMsg('Checking password strength…');
      const estimator = await loadZxcvbn();
      const { score } = estimator(data.password, data.username ? [data.username] : undefined);
      if (score < MIN_STRENGTH_SCORE) {
        setLoadingMsg('');
        setError(
          'Password is too easy to guess. Try a passphrase or a longer, less predictable phrase.',
        );
        return;
      }

      setLoadingMsg('Generating keys…');
      const r = await bootstrap(data.password);

      setLoadingMsg('Creating account…');
      const { enrollment } = await api.register({ username: data.username, ...r.registerBody });

      authFlow.setRegister({
        username: data.username,
        enrollment,
        keychain: { masterKey: r.masterKey, vaultKey: r.vaultKey },
        recoveryKey: r.recoveryKey,
      });

      navigate({ to: '/authenticator', search: { mode: 'register', username: data.username } });
    } catch (err) {
      setLoadingMsg('');
      setError(err instanceof Error ? err.message : 'Registration failed');
    }
  }

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle>Create account</CardTitle>
        <CardDescription>
          Pick a username and master password, then pair an authenticator app
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" aria-busy={!!loadingMsg}>
          <div className="field-group" data-invalid={!!errors.username}>
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              autoComplete="username"
              autoFocus
              placeholder="blindpass_user"
              aria-invalid={!!errors.username}
              aria-describedby={errors.username ? 'username-error' : undefined}
              {...register('username')}
            />
            <FieldError id="username-error" message={errors.username?.message} />
          </div>
          <div className="field-group" data-invalid={!!errors.password}>
            <Label htmlFor="password">Password</Label>
            <PasswordInput
              id="password"
              autoComplete="new-password"
              revealed={showPasswords}
              onRevealChange={setShowPasswords}
              aria-invalid={!!errors.password}
              aria-describedby={errors.password ? 'password-error' : undefined}
              {...register('password')}
            />
            <PasswordStrength
              password={passwordValue}
              userInputs={usernameValue ? [usernameValue] : undefined}
            />
            <PassphraseGenerator
              onAccept={(pw) => {
                setValue('password', pw, { shouldValidate: true, shouldDirty: true });
                setValue('confirmPassword', pw, { shouldValidate: true, shouldDirty: true });
                setShowPasswords(true);
              }}
            />
            <FieldError id="password-error" message={errors.password?.message} />
          </div>
          <div className="field-group" data-invalid={!!errors.confirmPassword}>
            <Label htmlFor="confirmPassword">Confirm password</Label>
            <PasswordInput
              id="confirmPassword"
              autoComplete="new-password"
              revealed={showPasswords}
              onRevealChange={setShowPasswords}
              aria-invalid={!!errors.confirmPassword}
              aria-describedby={errors.confirmPassword ? 'confirm-password-error' : undefined}
              {...register('confirmPassword')}
            />
            <FieldError id="confirm-password-error" message={errors.confirmPassword?.message} />
          </div>
          <FieldError message={error ?? undefined} />
          <Button type="submit" className="w-full" loading={!!loadingMsg} disabled={!!loadingMsg}>
            {loadingMsg || 'Create account'}
          </Button>
          <nav className="flex flex-wrap justify-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <Link to="/login" className="transition-colors hover:text-foreground">
              Sign in
            </Link>
            <span aria-hidden="true">·</span>
            <Link to="/recover" className="transition-colors hover:text-foreground">
              Recover access
            </Link>
          </nav>
        </form>
      </CardContent>
    </Card>
  );
}
