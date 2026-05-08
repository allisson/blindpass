import { useNavigate } from '@tanstack/react-router';
import { Eye, EyeOff, Loader2, Shield } from 'lucide-react';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { Button } from '@/components/ui/button';
import { FieldError } from '@/components/ui/field-error';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { OtpInput } from '@/components/ui/otp-input';
import { PasswordStrength } from '@/components/ui/password-strength';
import { MIN_PASSWORD_LENGTH } from '@/lib/constants';
import { useChangePassword } from '@/hooks/useChangePassword';
import { CEREMONY_PHASE_LABEL } from '@/lib/keychain/ceremony';
import { otpSchema, type OtpData } from './_shared';

const changePasswordStep1Schema = z
  .object({
    currentPassword: z.string().min(1, 'Current password required'),
    newPassword: z.string().min(MIN_PASSWORD_LENGTH, `At least ${MIN_PASSWORD_LENGTH} characters`),
    confirmPassword: z.string().min(1, 'Confirm your new password'),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type ChangeStep1Data = z.infer<typeof changePasswordStep1Schema>;

interface PendingChange {
  currentPassword: string;
  newPassword: string;
}

export function ChangePasswordSection() {
  const navigate = useNavigate();
  const [pending, setPending] = useState<PendingChange | null>(null);
  const [success, setSuccess] = useState(false);
  const [showFields, setShowFields] = useState({ current: false, new: false, confirm: false });
  const ceremony = useChangePassword();
  const loadingMsg = CEREMONY_PHASE_LABEL[ceremony.phase];
  const isRunning =
    ceremony.phase !== 'idle' && ceremony.phase !== 'error' && ceremony.phase !== 'done';

  const step1Form = useForm<ChangeStep1Data>({
    resolver: standardSchemaResolver(changePasswordStep1Schema),
  });

  const otpForm = useForm<OtpData>({
    resolver: standardSchemaResolver(otpSchema),
    defaultValues: { code: '' },
  });

  const newPasswordValue = step1Form.watch('newPassword', '');

  async function onStep1(data: ChangeStep1Data) {
    setPending({
      currentPassword: data.currentPassword,
      newPassword: data.newPassword,
    });
  }

  async function onOtp(data: OtpData) {
    if (!pending) return;
    const result = await ceremony.changePassword({
      currentPassword: pending.currentPassword,
      newPassword: pending.newPassword,
      authenticatorCode: data.code,
    });
    if (result.ok) {
      setSuccess(true);
      setTimeout(() => navigate({ to: '/login' }), 2000);
    }
  }

  if (success) {
    return (
      <div className="flex items-center gap-2 text-sm text-green-500 py-2">
        <Shield className="w-4 h-4" />
        Password changed. Redirecting to sign in…
      </div>
    );
  }

  if (pending) {
    return (
      <form
        onSubmit={otpForm.handleSubmit(onOtp)}
        className="space-y-4 max-w-sm"
        aria-busy={isRunning || otpForm.formState.isSubmitting}
      >
        <p className="text-xs text-muted-foreground">
          Enter a fresh 6-digit code from your authenticator app to confirm the password change.
        </p>
        <div className="space-y-1.5">
          <Controller
            name="code"
            control={otpForm.control}
            render={({ field }) => (
              <OtpInput
                value={field.value}
                onChange={field.onChange}
                autoFocus
                disabled={otpForm.formState.isSubmitting}
                aria-describedby={otpForm.formState.errors.code ? 'cp-otp-error' : undefined}
                aria-invalid={!!otpForm.formState.errors.code}
              />
            )}
          />
          <FieldError
            id="cp-otp-error"
            align="center"
            message={otpForm.formState.errors.code?.message}
          />
        </div>
        <FieldError message={ceremony.error?.message} />
        <div className="flex gap-2">
          <Button type="submit" size="sm" loading={isRunning} disabled={isRunning}>
            {loadingMsg || 'Confirm change'}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setPending(null);
              ceremony.reset();
            }}
          >
            Back
          </Button>
        </div>
      </form>
    );
  }

  return (
    <form
      onSubmit={step1Form.handleSubmit(onStep1)}
      className="space-y-4 max-w-sm"
      aria-busy={step1Form.formState.isSubmitting}
    >
      <div className="field-group" data-invalid={!!step1Form.formState.errors.currentPassword}>
        <Label htmlFor="cp-current">Current password</Label>
        <div className="relative">
          <Input
            id="cp-current"
            type={showFields.current ? 'text' : 'password'}
            autoComplete="current-password"
            className="pr-9"
            aria-invalid={!!step1Form.formState.errors.currentPassword}
            aria-describedby={
              step1Form.formState.errors.currentPassword ? 'cp-current-error' : undefined
            }
            {...step1Form.register('currentPassword')}
          />
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setShowFields((v) => ({ ...v, current: !v.current }))}
            aria-label={showFields.current ? 'Hide password' : 'Show password'}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          >
            {showFields.current ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        <FieldError
          id="cp-current-error"
          message={step1Form.formState.errors.currentPassword?.message}
        />
      </div>
      <div className="field-group" data-invalid={!!step1Form.formState.errors.newPassword}>
        <Label htmlFor="cp-new">New password</Label>
        <div className="relative">
          <Input
            id="cp-new"
            type={showFields.new ? 'text' : 'password'}
            autoComplete="new-password"
            className="pr-9"
            aria-invalid={!!step1Form.formState.errors.newPassword}
            aria-describedby={step1Form.formState.errors.newPassword ? 'cp-new-error' : undefined}
            {...step1Form.register('newPassword')}
          />
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setShowFields((v) => ({ ...v, new: !v.new }))}
            aria-label={showFields.new ? 'Hide password' : 'Show password'}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          >
            {showFields.new ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        <PasswordStrength password={newPasswordValue} />
        <FieldError id="cp-new-error" message={step1Form.formState.errors.newPassword?.message} />
      </div>
      <div className="field-group" data-invalid={!!step1Form.formState.errors.confirmPassword}>
        <Label htmlFor="cp-confirm">Confirm new password</Label>
        <div className="relative">
          <Input
            id="cp-confirm"
            type={showFields.confirm ? 'text' : 'password'}
            autoComplete="new-password"
            className="pr-9"
            aria-invalid={!!step1Form.formState.errors.confirmPassword}
            aria-describedby={
              step1Form.formState.errors.confirmPassword ? 'cp-confirm-error' : undefined
            }
            {...step1Form.register('confirmPassword')}
          />
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setShowFields((v) => ({ ...v, confirm: !v.confirm }))}
            aria-label={showFields.confirm ? 'Hide password' : 'Show password'}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          >
            {showFields.confirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        <FieldError
          id="cp-confirm-error"
          message={step1Form.formState.errors.confirmPassword?.message}
        />
      </div>
      <FieldError message={ceremony.error?.message} />
      <Button type="submit" size="sm" disabled={step1Form.formState.isSubmitting}>
        {step1Form.formState.isSubmitting ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          'Continue'
        )}
      </Button>
    </form>
  );
}
