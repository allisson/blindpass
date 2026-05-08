import { useNavigate } from '@tanstack/react-router';
import { AlertTriangle, ArrowLeft, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { Button } from '@/components/ui/button';
import { FieldError } from '@/components/ui/field-error';
import { OtpInput } from '@/components/ui/otp-input';
import { ResponsiveDialog } from '@/components/ui/responsive-dialog';
import { api } from '@/lib/api';
import { session } from '@/lib/session';
import { otpSchema, type OtpData } from './_shared';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Step = 'consequence' | 'otp';

export function DeleteAccountDialog({ open, onOpenChange }: Props) {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('consequence');
  const [error, setError] = useState<string | null>(null);

  const otpForm = useForm<OtpData>({
    resolver: standardSchemaResolver(otpSchema),
    defaultValues: { code: '' },
  });

  function handleOpenChange(next: boolean) {
    if (otpForm.formState.isSubmitting) return;
    if (!next) {
      setStep('consequence');
      setError(null);
      otpForm.reset({ code: '' });
    }
    onOpenChange(next);
  }

  function goToOtp() {
    setStep('otp');
  }

  function back() {
    setError(null);
    otpForm.reset({ code: '' });
    setStep('consequence');
  }

  async function onSubmit(data: OtpData) {
    setError(null);
    try {
      await api.deleteAccount({ authenticatorCode: data.code });
      session.clear();
      navigate({ to: '/login' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete account');
    }
  }

  if (step === 'consequence') {
    return (
      <ResponsiveDialog
        open={open}
        onOpenChange={handleOpenChange}
        showCloseButton
        title="Delete account?"
        description="This action cannot be undone."
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button variant="destructive" size="sm" onClick={goToOtp}>
              I understand, continue
            </Button>
          </>
        }
      >
        <div className="flex items-start gap-2.5 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2.5">
          <AlertTriangle className="w-3.5 h-3.5 text-destructive shrink-0 mt-0.5" />
          <p className="text-xs text-destructive/80">
            Your encrypted vault and all stored credentials will be permanently wiped from the
            server. Shares you've granted will be revoked. There is no recovery.
          </p>
        </div>
      </ResponsiveDialog>
    );
  }

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={handleOpenChange}
      showCloseButton={!otpForm.formState.isSubmitting}
      title="Confirm with your authenticator"
      description="Enter a fresh 6-digit code to permanently delete this account."
      footer={
        <>
          <Button
            variant="outline"
            size="sm"
            onClick={back}
            disabled={otpForm.formState.isSubmitting}
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back
          </Button>
          <Button
            type="submit"
            form="delete-account-otp-form"
            variant="destructive"
            size="sm"
            disabled={otpForm.formState.isSubmitting}
          >
            {otpForm.formState.isSubmitting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              'Permanently delete account'
            )}
          </Button>
        </>
      }
    >
      <form
        id="delete-account-otp-form"
        onSubmit={otpForm.handleSubmit(onSubmit)}
        className="space-y-3"
      >
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
      </form>
    </ResponsiveDialog>
  );
}
