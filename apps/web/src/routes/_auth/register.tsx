import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import {
  encryptMasterKey,
  encryptMasterKeyWithRecovery,
  encryptRecoveryKey,
  encryptVaultKey,
  generateKeyPair,
  generateMasterKey,
  generateRecoveryKey,
  generateSalt,
  generateVaultKey,
  encryptSymmetric,
} from '@blindpass/crypto';
import { deriveKEK } from '@/lib/kdfWorker';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FieldError } from '@/components/ui/field-error';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PasswordStrength } from '@/components/ui/password-strength';
import { PassphraseGenerator } from '@/components/ui/passphrase-generator';
import type { StrengthScore } from '@/lib/zxcvbn';
import { encryptVaultMetadata } from '@blindpass/vault';
import { api } from '@/lib/api';
import { authFlow } from '@/lib/authFlow';
import { toBase64, toBase64EncryptedValue } from '@/lib/b64';
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
  const [strengthScore, setStrengthScore] = useState<StrengthScore>(0);

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
    if (strengthScore < MIN_STRENGTH_SCORE) {
      setError(
        'Password is too easy to guess. Try a passphrase or a longer, less predictable phrase.',
      );
      return;
    }
    try {
      const kekSalt = await generateSalt();

      setLoadingMsg('Deriving encryption key…');
      const kek = await deriveKEK(data.password, kekSalt);

      setLoadingMsg('Generating keys…');
      const masterKey = await generateMasterKey();
      const recoveryKey = await generateRecoveryKey();
      const recoveryVerifier = toBase64(new TextEncoder().encode(recoveryKey));
      const { publicKey, privateKey } = await generateKeyPair();
      const vaultKey = await generateVaultKey();

      const encryptedMasterKey = await encryptMasterKey(masterKey, kek);
      const encryptedMasterKeyForRecovery = await encryptMasterKeyWithRecovery(
        masterKey,
        recoveryKey,
      );
      const encryptedPrivateKey = await encryptSymmetric(privateKey, masterKey);
      const encryptedRecoveryKey = await encryptRecoveryKey(recoveryKey, masterKey);
      const encryptedVaultKey = await encryptVaultKey(vaultKey, masterKey);
      const encryptedVaultData = await encryptVaultMetadata({ name: 'My Vault' }, vaultKey);

      kek.fill(0);
      privateKey.fill(0);

      setLoadingMsg('Creating account…');
      const { enrollment } = await api.register({
        username: data.username,
        kekSalt: toBase64(kekSalt),
        publicKey: toBase64(publicKey),
        encryptedMasterKey: toBase64EncryptedValue(encryptedMasterKey),
        encryptedMasterKeyForRecovery: toBase64EncryptedValue(encryptedMasterKeyForRecovery),
        encryptedPrivateKey: toBase64EncryptedValue(encryptedPrivateKey),
        encryptedRecoveryKey: toBase64EncryptedValue(encryptedRecoveryKey),
        encryptedVaultKey: toBase64EncryptedValue(encryptedVaultKey),
        encryptedVaultData: toBase64EncryptedValue(encryptedVaultData),
        recoveryVerifier,
      });

      authFlow.setRegister({
        username: data.username,
        enrollment,
        keychain: { masterKey, vaultKey },
        recoveryKey,
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
          Choose a permanent username and set up your zero-knowledge vault
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
            <div className="relative">
              <Input
                id="password"
                type={showPasswords ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="••••••••"
                className="pr-9"
                aria-invalid={!!errors.password}
                aria-describedby={errors.password ? 'password-error' : undefined}
                {...register('password')}
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowPasswords((v) => !v)}
                aria-label={showPasswords ? 'Hide password' : 'Show password'}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showPasswords ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <PasswordStrength
              password={passwordValue}
              userInputs={usernameValue ? [usernameValue] : undefined}
              onScoreChange={setStrengthScore}
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
            <div className="relative">
              <Input
                id="confirmPassword"
                type={showPasswords ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="••••••••"
                className="pr-9"
                aria-invalid={!!errors.confirmPassword}
                aria-describedby={errors.confirmPassword ? 'confirm-password-error' : undefined}
                {...register('confirmPassword')}
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowPasswords((v) => !v)}
                aria-label={showPasswords ? 'Hide password' : 'Show password'}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showPasswords ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <FieldError id="confirm-password-error" message={errors.confirmPassword?.message} />
          </div>
          <FieldError message={error ?? undefined} />
          <Button type="submit" className="w-full" loading={!!loadingMsg} disabled={!!loadingMsg}>
            {loadingMsg || 'Create account'}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{' '}
            <a href="/login" className="text-primary hover:underline">
              Sign in
            </a>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
