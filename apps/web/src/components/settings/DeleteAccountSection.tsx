import { useNavigate } from '@tanstack/react-router';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { Button } from '@/components/ui/button';
import { FieldError } from '@/components/ui/field-error';
import { OtpInput } from '@/components/ui/otp-input';
import { api } from '@/lib/api';
import { session } from '@/lib/session';
import { otpSchema, type OtpData } from './_shared';

export function DeleteAccountSection() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  const otpForm = useForm<OtpData>({
    resolver: standardSchemaResolver(otpSchema),
    defaultValues: { code: '' },
  });

  async function onOtp(data: OtpData) {
    setError(null);
    try {
      await api.deleteAccount({ authenticatorCode: data.code });
      session.clear();
      navigate({ to: '/login' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete account');
    }
  }

  return (
    <form onSubmit={otpForm.handleSubmit(onOtp)} className="space-y-4 max-w-sm">
      <div className="flex items-start gap-2.5 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2.5">
        <AlertTriangle className="w-3.5 h-3.5 text-destructive shrink-0 mt-0.5" />
        <p className="text-xs text-destructive/80">
          This permanently deletes your account, vault, and all stored credentials. This action
          cannot be undone.
        </p>
      </div>
      <p className="text-xs text-muted-foreground">
        Enter a fresh 6-digit code from your authenticator app to permanently delete this account.
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
              aria-describedby={otpForm.formState.errors.code ? 'da-otp-error' : undefined}
              aria-invalid={!!otpForm.formState.errors.code}
            />
          )}
        />
        <FieldError
          id="da-otp-error"
          align="center"
          message={otpForm.formState.errors.code?.message}
        />
      </div>
      <FieldError message={error ?? undefined} />
      <Button
        type="submit"
        size="sm"
        variant="destructive"
        disabled={otpForm.formState.isSubmitting}
      >
        {otpForm.formState.isSubmitting ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          'Permanently delete account'
        )}
      </Button>
    </form>
  );
}
