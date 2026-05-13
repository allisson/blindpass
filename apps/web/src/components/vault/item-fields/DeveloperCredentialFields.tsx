import { useCallback, useEffect, useRef, useState } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import { Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FieldError } from '@/components/ui/field-error';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ResponsiveDialog } from '@/components/ui/responsive-dialog';
import { Textarea } from '@/components/ui/textarea';
import type { DeveloperCredentialItem, VaultItem } from '@blindpass/vault';
import { asErrorMap } from './types';

type Mode = DeveloperCredentialItem['credentialMode'];

interface Props {
  initialMode?: Mode;
}

export function DeveloperCredentialFields({ initialMode = 'token' }: Props) {
  const {
    control,
    register,
    setValue,
    watch,
    getValues,
    formState: { errors: _errors },
  } = useFormContext<VaultItem>();
  const errors = asErrorMap(_errors);
  const credentialMode = watch('credentialMode' as never) as unknown as Mode | undefined;
  const [showTokenSecret, setShowTokenSecret] = useState(false);
  const [showClientSecret, setShowClientSecret] = useState(false);
  const [showSshPassphrase, setShowSshPassphrase] = useState(false);
  const [modeSwitch, setModeSwitch] = useState<{ from: Mode; to: Mode } | null>(null);
  const previousMode = useRef<Mode>(initialMode);
  const reverting = useRef(false);

  const clearFieldsForNewMode = useCallback(
    (newMode: Mode) => {
      if (newMode === 'token') {
        setValue('clientId' as never, '' as never);
        setValue('clientSecret' as never, '' as never);
        setValue('privateKey' as never, '' as never);
        setValue('publicKey' as never, '' as never);
        setValue('passphrase' as never, '' as never);
        setValue('username' as never, '' as never);
        setValue('host' as never, '' as never);
        setValue('algorithm' as never, '' as never);
        setValue('fingerprint' as never, '' as never);
        setShowClientSecret(false);
        setShowSshPassphrase(false);
      } else if (newMode === 'client_secret_pair') {
        setValue('secret' as never, '' as never);
        setValue('keyId' as never, '' as never);
        setValue('privateKey' as never, '' as never);
        setValue('publicKey' as never, '' as never);
        setValue('passphrase' as never, '' as never);
        setValue('username' as never, '' as never);
        setValue('host' as never, '' as never);
        setValue('algorithm' as never, '' as never);
        setValue('fingerprint' as never, '' as never);
        setShowTokenSecret(false);
        setShowSshPassphrase(false);
      } else {
        setValue('secret' as never, '' as never);
        setValue('keyId' as never, '' as never);
        setValue('clientId' as never, '' as never);
        setValue('clientSecret' as never, '' as never);
        setShowTokenSecret(false);
        setShowClientSecret(false);
      }
    },
    [setValue],
  );

  useEffect(() => {
    if (!credentialMode) return;
    if (reverting.current) {
      reverting.current = false;
      previousMode.current = credentialMode;
      return;
    }
    const prev = previousMode.current;
    if (credentialMode === prev) return;

    const prevHasData =
      prev === 'token'
        ? Boolean(getValues('secret' as never) || getValues('keyId' as never))
        : prev === 'client_secret_pair'
          ? Boolean(getValues('clientId' as never) || getValues('clientSecret' as never))
          : Boolean(
              getValues('privateKey' as never) ||
              getValues('publicKey' as never) ||
              getValues('passphrase' as never) ||
              getValues('username' as never) ||
              getValues('host' as never) ||
              getValues('algorithm' as never) ||
              getValues('fingerprint' as never),
            );

    if (prevHasData) {
      reverting.current = true;
      setValue('credentialMode' as never, prev as never, { shouldDirty: true });
      setModeSwitch({ from: prev, to: credentialMode });
      return;
    }

    clearFieldsForNewMode(credentialMode);
    previousMode.current = credentialMode;
  }, [credentialMode, getValues, setValue, clearFieldsForNewMode]);

  function handleConfirmModeSwitch() {
    if (!modeSwitch) return;
    const { to } = modeSwitch;
    previousMode.current = to;
    reverting.current = true;
    setValue('credentialMode' as never, to as never, { shouldDirty: true });
    clearFieldsForNewMode(to);
    setModeSwitch(null);
  }

  return (
    <>
      <div className="field-group" data-invalid={!!errors.credentialMode}>
        <Label htmlFor="credentialMode">Mode</Label>
        <Controller
          control={control}
          name={'credentialMode' as never}
          render={({ field }) => (
            <Select value={field.value as string} onValueChange={(v) => v && field.onChange(v)}>
              <SelectTrigger id="credentialMode" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="token">Token</SelectItem>
                <SelectItem value="client_secret_pair">Client ID + Secret</SelectItem>
                <SelectItem value="ssh_key">SSH keypair</SelectItem>
              </SelectContent>
            </Select>
          )}
        />
        <FieldError message={errors.credentialMode?.message} />
      </div>
      {credentialMode !== 'ssh_key' && (
        <>
          <div className="field-group" data-invalid={!!errors.provider}>
            <Label htmlFor="provider">Provider</Label>
            <Input
              id="provider"
              placeholder="OpenAI"
              autoComplete="off"
              {...register('provider' as never)}
            />
            <FieldError message={errors.provider?.message} />
          </div>
          <div className="grid grid-cols-1 gap-3">
            <div className="field-group">
              <Label htmlFor="environment" optional>
                Environment
              </Label>
              <Input
                id="environment"
                placeholder="production"
                autoComplete="off"
                {...register('environment' as never)}
              />
            </div>
            <div className="field-group" data-invalid={!!errors.baseUrl}>
              <Label htmlFor="baseUrl" optional>
                Base URL
              </Label>
              <Input
                id="baseUrl"
                type="url"
                placeholder="https://api.example.com"
                autoComplete="off"
                inputMode="url"
                {...register('baseUrl' as never, {
                  setValueAs: (value) =>
                    typeof value === 'string' && value.trim() === '' ? undefined : value,
                })}
              />
              <FieldError message={errors.baseUrl?.message} />
            </div>
          </div>
        </>
      )}
      {credentialMode === 'token' && (
        <>
          <div className="field-group" data-invalid={!!errors.secret}>
            <Label htmlFor="secret">Secret</Label>
            <div className="relative">
              <Input
                id="secret"
                type={showTokenSecret ? 'text' : 'password'}
                autoComplete="off"
                className="pr-9 font-mono"
                placeholder="sk-live-..."
                {...register('secret' as never)}
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowTokenSecret((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                aria-label={showTokenSecret ? 'Hide secret' : 'Show secret'}
              >
                {showTokenSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <FieldError message={errors.secret?.message} />
          </div>
          <div className="field-group">
            <Label htmlFor="keyId" optional>
              Key ID
            </Label>
            <Input
              id="keyId"
              placeholder="primary"
              autoComplete="off"
              {...register('keyId' as never)}
            />
          </div>
        </>
      )}
      {credentialMode === 'client_secret_pair' && (
        <>
          <div className="field-group" data-invalid={!!errors.clientId}>
            <Label htmlFor="clientId">Client ID</Label>
            <Input
              id="clientId"
              placeholder="service-client"
              autoComplete="off"
              {...register('clientId' as never)}
            />
            <FieldError message={errors.clientId?.message} />
          </div>
          <div className="field-group" data-invalid={!!errors.clientSecret}>
            <Label htmlFor="clientSecret">Client Secret</Label>
            <div className="relative">
              <Input
                id="clientSecret"
                type={showClientSecret ? 'text' : 'password'}
                autoComplete="off"
                className="pr-9 font-mono"
                placeholder="••••••••"
                {...register('clientSecret' as never)}
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowClientSecret((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                aria-label={showClientSecret ? 'Hide client secret' : 'Show client secret'}
              >
                {showClientSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <FieldError message={errors.clientSecret?.message} />
          </div>
        </>
      )}
      {credentialMode === 'ssh_key' && (
        <>
          <div className="grid grid-cols-1 gap-3">
            <div className="field-group" data-invalid={!!errors.username}>
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                placeholder="deploy"
                autoComplete="off"
                {...register('username' as never)}
              />
              <FieldError message={errors.username?.message} />
            </div>
            <div className="field-group" data-invalid={!!errors.host}>
              <Label htmlFor="host">Host</Label>
              <Input
                id="host"
                placeholder="bastion.example.com"
                autoComplete="off"
                {...register('host' as never)}
              />
              <FieldError message={errors.host?.message} />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3">
            <div className="field-group" data-invalid={!!errors.algorithm}>
              <Label htmlFor="algorithm" optional>
                Algorithm
              </Label>
              <Input
                id="algorithm"
                placeholder="ed25519"
                autoComplete="off"
                {...register('algorithm' as never)}
              />
              <FieldError message={errors.algorithm?.message} />
            </div>
            <div className="field-group">
              <Label htmlFor="fingerprint" optional>
                Fingerprint
              </Label>
              <Input
                id="fingerprint"
                placeholder="SHA256:abc123"
                autoComplete="off"
                {...register('fingerprint' as never)}
              />
            </div>
          </div>
          <div className="field-group" data-invalid={!!errors.publicKey}>
            <Label htmlFor="publicKey">Public Key</Label>
            <Textarea
              id="publicKey"
              placeholder="ssh-ed25519 AAAAC3Nza..."
              autoComplete="off"
              className="min-h-[96px] font-mono"
              {...register('publicKey' as never)}
            />
            <FieldError message={errors.publicKey?.message} />
          </div>
          <div className="field-group" data-invalid={!!errors.privateKey}>
            <Label htmlFor="privateKey">Private Key</Label>
            <Textarea
              id="privateKey"
              placeholder="-----BEGIN OPENSSH PRIVATE KEY-----"
              autoComplete="off"
              className="min-h-[140px] font-mono"
              {...register('privateKey' as never)}
            />
            <FieldError message={errors.privateKey?.message} />
          </div>
          <div className="field-group">
            <Label htmlFor="passphrase" optional>
              Passphrase
            </Label>
            <div className="relative">
              <Input
                id="passphrase"
                type={showSshPassphrase ? 'text' : 'password'}
                autoComplete="off"
                className="pr-9 font-mono"
                placeholder="Optional passphrase"
                {...register('passphrase' as never)}
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowSshPassphrase((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                aria-label={showSshPassphrase ? 'Hide passphrase' : 'Show passphrase'}
              >
                {showSshPassphrase ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </>
      )}
      <div className="field-group">
        <Label htmlFor="notes" optional>
          Notes
        </Label>
        <Textarea
          id="notes"
          placeholder="Optional notes"
          autoComplete="off"
          className="min-h-[80px]"
          {...register('notes' as never)}
        />
      </div>

      <ResponsiveDialog
        open={modeSwitch !== null}
        onOpenChange={() => setModeSwitch(null)}
        title="Switch mode?"
        description="Fields for the current mode will be cleared."
        footer={
          <>
            <Button onClick={handleConfirmModeSwitch}>Switch mode</Button>
            <Button variant="outline" onClick={() => setModeSwitch(null)}>
              Keep editing
            </Button>
          </>
        }
      />
    </>
  );
}
