import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FieldError } from '@/components/ui/field-error';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { OtpInput } from '@/components/ui/otp-input';
import { PasswordStrength } from '@/components/ui/password-strength';
import { TotpQrSetup } from '@/components/ui/totp-qr-setup';
import { authFlow } from '@/lib/authFlow';
import { CEREMONY_PHASE_LABEL } from '@/lib/keychain/ceremony';
import { useUnlockWithRecovery } from '@/hooks/useUnlockWithRecovery';
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
  const [recovery] = useState(() => authFlow.getRecovery());
  const [recoveryPhrase] = useState(() => authFlow.getRecoveryKey());
  const [showPasswords, setShowPasswords] = useState(false);
  const ceremony = useUnlockWithRecovery();
  const loadingMsg = CEREMONY_PHASE_LABEL[ceremony.phase];
  const isRunning =
    ceremony.phase !== 'idle' && ceremony.phase !== 'error' && ceremony.phase !== 'done';

  useEffect(() => {
    if (!recovery || !recoveryPhrase) {
      navigate({ to: '/recover' });
    }
  }, [recovery, recoveryPhrase, navigate]);

  const {
    register,
    handleSubmit,
    watch,
    control,
    formState: { errors },
  } = useForm<FormData>({ resolver: standardSchemaResolver(schema) });

  const passwordValue = watch('password', '');

  async function onSubmit(data: FormData) {
    if (!recovery || !recoveryPhrase) return;
    const result = await ceremony.completeRecovery({
      newPassword: data.password,
      authenticatorCode: data.authenticatorCode,
    });
    if (result.ok) navigate({ to: '/recovery-key' });
  }

  if (!recovery || !recoveryPhrase) return null;

  return (
    <Card className="auth-card">
      <CardHeader>
        <CardTitle>Finish recovery</CardTitle>
        <CardDescription>
          Add the new setup key below to your authenticator app, then enter one valid code and
          choose a new master password.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" aria-busy={isRunning}>
          <TotpQrSetup
            otpauthUri={recovery.enrollment.otpauthUri}
            setupKey={recovery.enrollment.setupKey}
          />
          <div className="field-group" data-invalid={!!errors.authenticatorCode}>
            <Label htmlFor="authenticatorCode">Authenticator code</Label>
            <Controller
              name="authenticatorCode"
              control={control}
              render={({ field }) => (
                <OtpInput
                  value={field.value ?? ''}
                  onChange={field.onChange}
                  autoFocus
                  disabled={isRunning}
                  aria-describedby={
                    errors.authenticatorCode ? 'authenticator-code-error' : undefined
                  }
                  aria-invalid={!!errors.authenticatorCode}
                />
              )}
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
          <FieldError message={ceremony.error?.message} />
          <Button type="submit" className="w-full" loading={isRunning} disabled={isRunning}>
            {loadingMsg || 'Complete recovery'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
