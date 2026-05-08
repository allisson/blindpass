import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FieldError } from '@/components/ui/field-error';
import { OtpInput } from '@/components/ui/otp-input';
import { TotpQrSetup } from '@/components/ui/totp-qr-setup';
import { api } from '@/lib/api';
import { authFlow } from '@/lib/authFlow';
import { decryptKeyPair, unlockWithPassword } from '@/lib/keychain';
import { fetchAllPages } from '@/lib/fetchAllPages';
import { session, setLastUsername } from '@/lib/session';
import { buildVaultsMap } from '@/lib/vaultUtils';

export const Route = createFileRoute('/_auth/authenticator')({
  validateSearch: z.object({ mode: z.enum(['register', 'login']), username: z.string() }),
  component: VerifyOtpPage,
});

const schema = z.object({
  code: z
    .string()
    .length(6)
    .regex(/^\d{6}$/, 'Must be 6 digits'),
});

type FormData = z.infer<typeof schema>;

function VerifyOtpPage() {
  const navigate = useNavigate();
  const { mode, username } = Route.useSearch();
  const [error, setError] = useState<string | null>(null);
  const [loadingMsg, setLoadingMsg] = useState('');

  const {
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: standardSchemaResolver(schema), defaultValues: { code: '' } });

  async function onSubmit(data: FormData) {
    setError(null);
    try {
      if (mode === 'register') {
        const pending = authFlow.getRegister();
        if (!pending) throw new Error('Registration state lost. Please start over.');

        const bundle = await api.completeRegistration({
          username: pending.username,
          enrollmentId: pending.enrollment.enrollmentId,
          authenticatorCode: data.code,
        });
        const keyPair = await decryptKeyPair(
          bundle.encryptedPrivateKey,
          bundle.publicKey,
          pending.keychain.masterKey,
        );

        session.set({
          username: pending.username,
          activeVaultId: '',
          vaults: new Map(),
          keychain: pending.keychain,
          keyPair,
        });
        const vaults = await fetchAllPages((cursor) =>
          api.getVault(cursor).then((r) => ({ data: r.vaults, nextCursor: r.nextCursor })),
        );
        const vault = vaults.find((v) => !v.isShared);
        if (!vault) throw new Error('No vault found after registration.');

        const vaultsMap = await buildVaultsMap(vaults, pending.keychain.masterKey, keyPair);
        const fullSession = {
          username: pending.username,
          activeVaultId: vault.id,
          vaults: vaultsMap,
          keychain: pending.keychain,
          keyPair,
        };
        authFlow.setPendingSession(fullSession);
        authFlow.setRecoveryKey(pending.recoveryKey);
        authFlow.clearRegister();
        setLastUsername(pending.username);
        session.set({ ...fullSession, keychain: null });
        navigate({ to: '/recovery-key' });
        return;
      }

      const loginPending = authFlow.getLogin();
      if (!loginPending) throw new Error('Login state lost. Please start over.');

      await api.completeLogin({ username: loginPending.username, authenticatorCode: data.code });

      setLoadingMsg('Fetching keys…');
      const keysData = await api.getKeys();

      setLoadingMsg('Decrypting vault…');
      const { masterKey, keyPair } = await unlockWithPassword(loginPending.password, keysData);

      session.set({
        username: loginPending.username,
        activeVaultId: '',
        vaults: new Map(),
        keychain: { masterKey, vaultKey: new Uint8Array(32) },
        keyPair,
      });

      const vaults = await fetchAllPages((cursor) =>
        api.getVault(cursor).then((r) => ({ data: r.vaults, nextCursor: r.nextCursor })),
      );
      const ownedVault = vaults.find((v) => !v.isShared);
      if (!ownedVault) throw new Error('No vault found.');

      const vaultsMap = await buildVaultsMap(vaults, masterKey, keyPair);
      const activeVaultId = ownedVault.id;
      const keychain = { masterKey, vaultKey: vaultsMap.get(activeVaultId)!.vaultKey };

      authFlow.clearLogin();
      session.set({
        username: loginPending.username,
        activeVaultId,
        vaults: vaultsMap,
        keychain,
        keyPair,
      });
      setLastUsername(loginPending.username);
      navigate({ to: '/' });
    } catch (err) {
      session.clear();
      setLoadingMsg('');
      setError(err instanceof Error ? err.message : 'Verification failed');
    }
  }

  const title = mode === 'register' ? 'Confirm authenticator setup' : 'Enter authenticator code';

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>
          Enter the 6-digit code from your authenticator app for{' '}
          <span className="text-foreground font-medium">{username}</span>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-4"
          aria-busy={!!loadingMsg || isSubmitting}
        >
          {mode === 'register' &&
            (() => {
              const enrollment = authFlow.getRegister()?.enrollment;
              return enrollment ? (
                <TotpQrSetup otpauthUri={enrollment.otpauthUri} setupKey={enrollment.setupKey} />
              ) : null;
            })()}
          <div className="space-y-1.5">
            <Controller
              name="code"
              control={control}
              render={({ field }) => (
                <OtpInput
                  value={field.value}
                  onChange={field.onChange}
                  autoFocus
                  disabled={!!loadingMsg || isSubmitting}
                  aria-describedby={errors.code ? 'otp-code-error' : undefined}
                  aria-invalid={!!errors.code}
                />
              )}
            />
            <FieldError id="otp-code-error" align="center" message={errors.code?.message} />
          </div>
          {error && (
            <div className="space-y-1 text-center">
              <FieldError align="center" message={error} data-testid="error-message" />
              {error.includes('state lost') && (
                <Link to="/login" className="text-xs text-muted-foreground underline">
                  Back to login
                </Link>
              )}
            </div>
          )}
          <Button
            type="submit"
            className="w-full"
            loading={!!loadingMsg || isSubmitting}
            disabled={!!loadingMsg || isSubmitting}
          >
            {loadingMsg || (isSubmitting ? 'Verifying…' : 'Verify')}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
