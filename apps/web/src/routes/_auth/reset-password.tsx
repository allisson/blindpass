import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FieldError } from '@/components/ui/field-error';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PasswordStrength } from '@/components/ui/password-strength';
import { TotpQrSetup } from '@/components/ui/totp-qr-setup';
import { api } from '@/lib/api';
import { authFlow } from '@/lib/authFlow';
import { rekey, unlockWithRecovery } from '@/lib/keychain';
import { fetchAllPages } from '@/lib/fetchAllPages';
import { session } from '@/lib/session';
import { buildVaultsMap } from '@/lib/vaultUtils';
import { MIN_PASSWORD_LENGTH } from '@/lib/constants';

export const Route = createFileRoute('/_auth/reset-password')({
  component: ResetPasswordPage,
});

const schema = z
  .object({
    authenticatorCode: z
      .string()
      .length(6)
      .regex(/^\d{6}$/, 'Must be 6 digits'),
    password: z.string().min(MIN_PASSWORD_LENGTH, `At least ${MIN_PASSWORD_LENGTH} characters`),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type FormData = z.infer<typeof schema>;

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [loadingMsg, setLoadingMsg] = useState('');
  const [recovery] = useState(() => authFlow.getRecovery());
  const [recoveryPhrase] = useState(() => authFlow.getRecoveryKey());
  const [showPasswords, setShowPasswords] = useState(false);

  useEffect(() => {
    if (!recovery || !recoveryPhrase) {
      navigate({ to: '/recover' });
    }
  }, [recovery, recoveryPhrase, navigate]);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormData>({ resolver: standardSchemaResolver(schema) });

  const passwordValue = watch('password', '');

  async function onSubmit(data: FormData) {
    setError(null);
    if (!recovery || !recoveryPhrase) return;

    try {
      const { bundle } = recovery;

      setLoadingMsg('Recovering keys…');
      const { masterKey, keyPair } = await unlockWithRecovery(recoveryPhrase, bundle);

      setLoadingMsg('Deriving encryption key…');
      const re = await rekey(masterKey, data.password);

      setLoadingMsg('Completing recovery…');
      await api.completeRecovery({
        username: recovery.username,
        recoveryToken: recovery.recoveryToken,
        enrollmentId: recovery.enrollment.enrollmentId,
        authenticatorCode: data.authenticatorCode,
        kekSalt: re.kekSalt,
        publicKey: bundle.publicKey,
        encryptedMasterKey: re.encryptedMasterKey,
        encryptedMasterKeyForRecovery: re.encryptedMasterKeyForRecovery,
        encryptedPrivateKey: bundle.encryptedPrivateKey,
        encryptedRecoveryKey: re.encryptedRecoveryKey,
        recoveryVerifier: re.recoveryVerifier,
      });

      setLoadingMsg('Restoring session…');
      const vaults = await fetchAllPages((cursor) =>
        api.getVault(cursor).then((r) => ({ data: r.vaults, nextCursor: r.nextCursor })),
      );
      const vault = vaults.find((v) => !v.isShared);
      if (!vault) throw new Error('No vault found.');
      const vaultsMap = await buildVaultsMap(vaults, masterKey, keyPair);
      const activeVaultId = vault.id;
      const activeVault = vaultsMap.get(activeVaultId);
      if (!activeVault) throw new Error('Recovered vault missing from session');
      const keychain = { masterKey, vaultKey: activeVault.vaultKey };

      authFlow.clearRecovery();
      authFlow.setRecoveryKey(re.newRecoveryKey);
      authFlow.setPendingSession({
        username: recovery.username,
        activeVaultId,
        vaults: vaultsMap,
        keychain,
        keyPair,
      });
      session.set({
        username: recovery.username,
        activeVaultId,
        vaults: vaultsMap,
        keychain: null,
        keyPair,
      });
      navigate({ to: '/recovery-key' });
    } catch (err) {
      setLoadingMsg('');
      session.clear();
      const msg = err instanceof Error ? err.message : 'Recovery failed';
      setError(
        msg.includes('wrong') || msg.includes('ciphertext') || msg.includes('mac')
          ? 'Invalid recovery phrase. Check your 24 words and try again.'
          : msg,
      );
    }
  }

  if (!recovery || !recoveryPhrase) return null;

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle>Finish recovery</CardTitle>
        <CardDescription>
          Add the new setup key below to your authenticator app, then enter one valid code and
          choose a new master password.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" aria-busy={!!loadingMsg}>
          <TotpQrSetup
            otpauthUri={recovery.enrollment.otpauthUri}
            setupKey={recovery.enrollment.setupKey}
          />
          <div className="field-group" data-invalid={!!errors.authenticatorCode}>
            <Label htmlFor="authenticatorCode">Authenticator code</Label>
            <Input
              id="authenticatorCode"
              autoFocus
              inputMode="numeric"
              placeholder="123456"
              aria-invalid={!!errors.authenticatorCode}
              aria-describedby={errors.authenticatorCode ? 'authenticator-code-error' : undefined}
              {...register('authenticatorCode')}
            />
            <FieldError id="authenticator-code-error" message={errors.authenticatorCode?.message} />
          </div>
          <div className="field-group" data-invalid={!!errors.password}>
            <Label htmlFor="password">New master password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPasswords ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="••••••••"
                className="pr-9"
                aria-invalid={!!errors.password}
                aria-describedby={errors.password ? 'rp-password-error' : undefined}
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
            <PasswordStrength password={passwordValue} />
            <FieldError id="rp-password-error" message={errors.password?.message} />
          </div>
          <div className="field-group" data-invalid={!!errors.confirmPassword}>
            <Label htmlFor="confirmPassword">Confirm new password</Label>
            <div className="relative">
              <Input
                id="confirmPassword"
                type={showPasswords ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="••••••••"
                className="pr-9"
                aria-invalid={!!errors.confirmPassword}
                aria-describedby={errors.confirmPassword ? 'rp-confirm-error' : undefined}
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
            <FieldError id="rp-confirm-error" message={errors.confirmPassword?.message} />
          </div>
          <FieldError message={error ?? undefined} />
          <Button type="submit" className="w-full" loading={!!loadingMsg} disabled={!!loadingMsg}>
            {loadingMsg || 'Complete recovery'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
