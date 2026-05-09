import { useNavigate } from '@tanstack/react-router';
import { Loader2, Shield } from 'lucide-react';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { Button } from '@/components/ui/button';
import { FieldError } from '@/components/ui/field-error';
import { Label } from '@/components/ui/label';
import { OtpInput } from '@/components/ui/otp-input';
import { PasswordInput } from '@/components/ui/password-input';
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
    }
  }

  if (success) {
    return (
      <div className="space-y-3 max-w-sm">
        <div className="flex items-center gap-2 text-sm text-accent-teal">
          <Shield className="w-4 h-4" />
          Password changed. Sign in again to continue.
        </div>
        <Button size="sm" onClick={() => navigate({ to: '/login' })}>
          Sign in
        </Button>
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
          Step 2 of 2 · Confirm with a fresh authenticator code.
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
        <PasswordInput
          id="cp-current"
          autoComplete="current-password"
          aria-invalid={!!step1Form.formState.errors.currentPassword}
          aria-describedby={
            step1Form.formState.errors.currentPassword ? 'cp-current-error' : undefined
          }
          {...step1Form.register('currentPassword')}
        />
        <FieldError
          id="cp-current-error"
          message={step1Form.formState.errors.currentPassword?.message}
        />
      </div>
      <div className="field-group" data-invalid={!!step1Form.formState.errors.newPassword}>
        <Label htmlFor="cp-new">New password</Label>
        <PasswordInput
          id="cp-new"
          autoComplete="new-password"
          aria-invalid={!!step1Form.formState.errors.newPassword}
          aria-describedby={step1Form.formState.errors.newPassword ? 'cp-new-error' : undefined}
          {...step1Form.register('newPassword')}
        />
        <PasswordStrength password={newPasswordValue} />
        <FieldError id="cp-new-error" message={step1Form.formState.errors.newPassword?.message} />
      </div>
      <div className="field-group" data-invalid={!!step1Form.formState.errors.confirmPassword}>
        <Label htmlFor="cp-confirm">Confirm new password</Label>
        <PasswordInput
          id="cp-confirm"
          autoComplete="new-password"
          aria-invalid={!!step1Form.formState.errors.confirmPassword}
          aria-describedby={
            step1Form.formState.errors.confirmPassword ? 'cp-confirm-error' : undefined
          }
          {...step1Form.register('confirmPassword')}
        />
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
