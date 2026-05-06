import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import type { StandardSchemaV1 } from '@standard-schema/spec';
import {
  CryptoWalletItemSchema,
  DeveloperCredentialItemSchema,
  LoginItemSchema,
  SecureNoteSchema,
  PaymentCardSchema,
  IdentitySchema,
  TotpItemSchema,
  type CryptoWalletItem,
  type DeveloperCredentialItem,
  type VaultItem,
} from '@blindpass/vault';
import { ChevronDown, ChevronRight, Eye, EyeOff, Plus, Trash2, AlertTriangle } from 'lucide-react';
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { useBlocker } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { FieldError } from '@/components/ui/field-error';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PasswordStrength } from '@/components/ui/password-strength';
import { Textarea } from '@/components/ui/textarea';
import { useSubmitShortcut } from '@/hooks/useSubmitShortcut';
import { parseOtpauthUri } from '@/lib/totp';
import { ResponsiveDialog } from '@/components/ui/responsive-dialog';
import { MnemonicGrid } from './MnemonicGrid';

const PasswordGeneratorDialog = lazy(() =>
  import('./PasswordGeneratorDialog').then((m) => ({ default: m.PasswordGeneratorDialog })),
);

const schemaMap = {
  login: LoginItemSchema,
  secure_note: SecureNoteSchema,
  payment_card: PaymentCardSchema,
  identity: IdentitySchema,
  totp: TotpItemSchema,
  developer_credential: DeveloperCredentialItemSchema,
  crypto_wallet: CryptoWalletItemSchema,
};

interface Props {
  type: VaultItem['type'];
  defaultValues?: Partial<VaultItem>;
  onSubmit: (data: VaultItem) => Promise<void>;
  onCancel: () => void;
  submitLabel?: string;
}

export function ItemForm({ type, defaultValues, onSubmit, onCancel, submitLabel = 'Save' }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showTotpAdvanced, setShowTotpAdvanced] = useState(false);
  const [totpUriError, setTotpUriError] = useState<string | null>(null);
  const [totpUriParsed, setTotpUriParsed] = useState(false);
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);
  const [showModeSwitch, setShowModeSwitch] = useState<{
    from: DeveloperCredentialItem['credentialMode'];
    to: DeveloperCredentialItem['credentialMode'];
  } | null>(null);
  const developerDefaults =
    defaultValues?.type === 'developer_credential'
      ? (defaultValues as Partial<DeveloperCredentialItem>)
      : undefined;
  const walletDefaults =
    defaultValues?.type === 'crypto_wallet'
      ? (defaultValues as Partial<CryptoWalletItem>)
      : undefined;
  const initialValues =
    type === 'developer_credential'
      ? ({ type, credentialMode: 'token', ...developerDefaults } as Partial<VaultItem>)
      : type === 'crypto_wallet'
        ? ({ type, walletMode: 'bip39', ...walletDefaults } as Partial<VaultItem>)
        : ({ type, ...defaultValues } as Partial<VaultItem>);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    getValues,
    control,
    formState: { errors: _errors, isSubmitting, isDirty },
  } = useForm<VaultItem>({
    resolver: standardSchemaResolver(schemaMap[type] as StandardSchemaV1<VaultItem>),
    defaultValues: initialValues,
  });
  // errors is typed as FieldErrors<VaultItem> (discriminated union); cast to
  // a plain record so per-type field accesses compile without narrowing.
  const errors = _errors as Record<string, { message?: string } | undefined>;

  const discardConfirmed = useRef(false);

  useBlocker({
    shouldBlockFn: () => {
      if (discardConfirmed.current) {
        discardConfirmed.current = false;
        return false;
      }
      return true;
    },
    disabled: !isDirty || isSubmitting,
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'customFields' });
  const passwordValue: string = type === 'login' ? (watch('password') ?? '') : '';
  const [showTokenSecret, setShowTokenSecret] = useState(false);
  const [showClientSecret, setShowClientSecret] = useState(false);
  const [showSshPassphrase, setShowSshPassphrase] = useState(false);
  const [showWalletPassphrase, setShowWalletPassphrase] = useState(false);
  const developerCredentialMode =
    type === 'developer_credential' ? watch('credentialMode') : undefined;
  const previousDeveloperMode = useRef<DeveloperCredentialItem['credentialMode']>(
    developerDefaults?.credentialMode ?? 'token',
  );
  const revertingDeveloperMode = useRef(false);

  const clearFieldsForNewMode = useCallback(
    (newMode: DeveloperCredentialItem['credentialMode']) => {
      if (newMode === 'token') {
        setValue('clientId', '');
        setValue('clientSecret', '');
        setValue('privateKey', '');
        setValue('publicKey', '');
        setValue('passphrase', '');
        setValue('username', '');
        setValue('host', '');
        setValue('algorithm', '');
        setValue('fingerprint', '');
        setShowClientSecret(false);
        setShowSshPassphrase(false);
      } else if (newMode === 'client_secret_pair') {
        setValue('secret', '');
        setValue('keyId', '');
        setValue('privateKey', '');
        setValue('publicKey', '');
        setValue('passphrase', '');
        setValue('username', '');
        setValue('host', '');
        setValue('algorithm', '');
        setValue('fingerprint', '');
        setShowTokenSecret(false);
        setShowSshPassphrase(false);
      } else {
        setValue('secret', '');
        setValue('keyId', '');
        setValue('clientId', '');
        setValue('clientSecret', '');
        setShowTokenSecret(false);
        setShowClientSecret(false);
      }
    },
    [setValue],
  );

  useEffect(() => {
    if (type !== 'developer_credential') return;
    const currentMode = developerCredentialMode as
      | DeveloperCredentialItem['credentialMode']
      | undefined;
    if (!currentMode) return;
    if (revertingDeveloperMode.current) {
      revertingDeveloperMode.current = false;
      previousDeveloperMode.current = currentMode;
      return;
    }
    const previousMode = previousDeveloperMode.current;
    if (currentMode === previousMode) return;

    const previousModeHasData =
      previousMode === 'token'
        ? Boolean(getValues('secret') || getValues('keyId'))
        : previousMode === 'client_secret_pair'
          ? Boolean(getValues('clientId') || getValues('clientSecret'))
          : Boolean(
              getValues('privateKey') ||
              getValues('publicKey') ||
              getValues('passphrase') ||
              getValues('username') ||
              getValues('host') ||
              getValues('algorithm') ||
              getValues('fingerprint'),
            );

    if (previousModeHasData) {
      revertingDeveloperMode.current = true;
      setValue('credentialMode', previousMode, { shouldDirty: true });
      setShowModeSwitch({ from: previousMode, to: currentMode });
      return;
    }

    clearFieldsForNewMode(currentMode);
    previousDeveloperMode.current = currentMode;
  }, [developerCredentialMode, getValues, setValue, type, clearFieldsForNewMode]);

  async function handleFormSubmit(data: VaultItem) {
    setError(null);
    try {
      await onSubmit(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save item');
    }
  }

  function handleCancel() {
    if (isDirty) {
      setShowDiscardDialog(true);
    } else {
      onCancel();
    }
  }

  function handleConfirmDiscard() {
    discardConfirmed.current = true;
    setShowDiscardDialog(false);
    onCancel();
  }

  function handleConfirmModeSwitch() {
    const { to } = showModeSwitch!;
    previousDeveloperMode.current = to;
    revertingDeveloperMode.current = true;
    setValue('credentialMode', to, { shouldDirty: true });
    clearFieldsForNewMode(to);
    setShowModeSwitch(null);
  }

  const formRef = useRef<HTMLFormElement>(null);
  useSubmitShortcut(formRef);

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit((data) => handleFormSubmit(data as VaultItem))}
      className="space-y-4"
      aria-busy={isSubmitting}
    >
      <input type="hidden" {...register('type')} />

      <div className="field-group" data-invalid={!!errors.title}>
        <Label htmlFor="title">Title</Label>
        <Input id="title" placeholder="My Account" {...register('title')} />
        <FieldError message={errors.title?.message} />
      </div>

      {type === 'login' && (
        <>
          <div className="field-group" data-invalid={!!errors.username}>
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              placeholder="user@example.com"
              autoComplete="off"
              {...register('username')}
            />
            <FieldError message={errors.username?.message} />
          </div>
          <div className="field-group" data-invalid={!!errors.password}>
            <Label htmlFor="password">Password</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="••••••••"
                  className="pr-9"
                  {...register('password')}
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <Suspense fallback={null}>
                <PasswordGeneratorDialog
                  onUse={(p) => {
                    setValue('password', p, { shouldValidate: true });
                    setShowPassword(true);
                  }}
                />
              </Suspense>
            </div>
            <FieldError message={errors.password?.message} />
            <PasswordStrength password={passwordValue} />
          </div>
          <div className="field-group" data-invalid={!!errors.url}>
            <Label htmlFor="url" optional>
              URL
            </Label>
            <Input
              id="url"
              type="url"
              placeholder="https://example.com"
              autoComplete="off"
              inputMode="url"
              {...register('url')}
            />
            <FieldError message={errors.url?.message} />
          </div>
          <div className="field-group">
            <Label htmlFor="notes" optional>
              Notes
            </Label>
            <Textarea
              id="notes"
              placeholder="Optional notes"
              autoComplete="off"
              className="min-h-[80px]"
              {...register('notes')}
            />
          </div>
        </>
      )}

      {type === 'secure_note' && (
        <div className="field-group" data-invalid={!!errors.content}>
          <Label htmlFor="content">Content</Label>
          <Textarea
            id="content"
            placeholder="Your secure note…"
            autoComplete="off"
            className="min-h-[160px]"
            {...register('content')}
          />
          <FieldError message={errors.content?.message} />
        </div>
      )}

      {type === 'payment_card' && (
        <>
          <div className="field-group" data-invalid={!!errors.cardholderName}>
            <Label htmlFor="cardholderName">Cardholder Name</Label>
            <Input
              id="cardholderName"
              placeholder="Jane Doe"
              autoComplete="off"
              {...register('cardholderName')}
            />
            <FieldError message={errors.cardholderName?.message} />
          </div>
          <div className="field-group" data-invalid={!!errors.number}>
            <Label htmlFor="number">Card Number</Label>
            <Input
              id="number"
              placeholder="1234 5678 9012 3456"
              inputMode="numeric"
              autoComplete="off"
              {...register('number')}
            />
            <FieldError message={errors.number?.message} />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <div className="field-group col-span-1" data-invalid={!!errors.expMonth}>
              <Label htmlFor="expMonth">Month</Label>
              <Input
                id="expMonth"
                placeholder="MM"
                inputMode="numeric"
                maxLength={2}
                {...register('expMonth')}
              />
              <FieldError message={errors.expMonth?.message} />
            </div>
            <div className="field-group col-span-1" data-invalid={!!errors.expYear}>
              <Label htmlFor="expYear">Year</Label>
              <Input
                id="expYear"
                placeholder="YYYY"
                inputMode="numeric"
                maxLength={4}
                {...register('expYear')}
              />
              <FieldError message={errors.expYear?.message} />
            </div>
            <div className="field-group col-span-1">
              <Label htmlFor="cvv" optional>
                CVV
              </Label>
              <Input
                id="cvv"
                placeholder="123"
                inputMode="numeric"
                maxLength={4}
                {...register('cvv')}
              />
            </div>
          </div>
          <div className="field-group">
            <Label htmlFor="notes" optional>
              Notes
            </Label>
            <Textarea
              id="notes"
              placeholder="Optional notes"
              autoComplete="off"
              className="min-h-[80px]"
              {...register('notes')}
            />
          </div>
        </>
      )}

      {type === 'identity' && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div className="field-group" data-invalid={!!errors.firstName}>
              <Label htmlFor="firstName">First Name</Label>
              <Input id="firstName" placeholder="Jane" {...register('firstName')} />
              <FieldError message={errors.firstName?.message} />
            </div>
            <div className="field-group" data-invalid={!!errors.lastName}>
              <Label htmlFor="lastName">Last Name</Label>
              <Input id="lastName" placeholder="Doe" {...register('lastName')} />
              <FieldError message={errors.lastName?.message} />
            </div>
          </div>
          <div className="field-group">
            <Label htmlFor="email" optional>
              Email
            </Label>
            <Input id="email" type="email" placeholder="jane@example.com" {...register('email')} />
          </div>
          <div className="field-group">
            <Label htmlFor="phone" optional>
              Phone
            </Label>
            <Input
              id="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="+1 555 000 0000"
              {...register('phone')}
            />
          </div>
          <div className="field-group">
            <Label htmlFor="address" optional>
              Address
            </Label>
            <Input id="address" placeholder="123 Main St" {...register('address')} />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div className="field-group">
              <Label htmlFor="city" optional>
                City
              </Label>
              <Input
                id="city"
                autoComplete="address-level2"
                placeholder="New York"
                {...register('city')}
              />
            </div>
            <div className="field-group">
              <Label htmlFor="country" optional>
                Country
              </Label>
              <Input
                id="country"
                autoComplete="country"
                placeholder="US"
                {...register('country')}
              />
            </div>
          </div>
          <div className="field-group">
            <Label htmlFor="notes" optional>
              Notes
            </Label>
            <Textarea
              id="notes"
              placeholder="Optional notes"
              autoComplete="off"
              className="min-h-[80px]"
              {...register('notes')}
            />
          </div>
        </>
      )}

      {type === 'totp' && (
        <>
          <div className="field-group" data-invalid={!!totpUriError}>
            <Label htmlFor="totp-uri">Paste URI or Secret</Label>
            <textarea
              id="totp-uri"
              placeholder="otpauth://totp/… or Base32 secret"
              autoComplete="off"
              className="h-auto min-h-[72px] w-full resize-none rounded-lg border border-input bg-transparent px-3 py-2 font-mono text-xs transition-all outline-none placeholder:text-muted-foreground focus-visible:border-ring disabled:pointer-events-none disabled:cursor-not-allowed dark:bg-input/20"
              onChange={(e) => {
                const val = e.target.value.trim();
                setTotpUriError(null);
                setTotpUriParsed(false);
                if (val.startsWith('otpauth://')) {
                  const parsed = parseOtpauthUri(val);
                  if (parsed) {
                    setValue('secret', parsed.secret, { shouldValidate: true });
                    if (parsed.issuer) {
                      setValue('issuer', parsed.issuer);
                      if (!watch('title')) {
                        setValue('title', parsed.issuer);
                      }
                    }
                    if (parsed.accountName) setValue('accountName', parsed.accountName);
                    setValue('algorithm', parsed.algorithm);
                    setValue('digits', parsed.digits);
                    setValue('period', parsed.period);
                    setShowTotpAdvanced(
                      parsed.algorithm !== 'SHA1' || parsed.digits !== 6 || parsed.period !== 30,
                    );
                    setTotpUriParsed(true);
                  } else {
                    setTotpUriError(
                      "Couldn't parse this URI. Try pasting the Base32 secret directly.",
                    );
                  }
                } else {
                  setValue('secret', val, { shouldValidate: true });
                }
              }}
            />
            {totpUriError ? (
              <FieldError message={totpUriError} />
            ) : totpUriParsed ? (
              <p className="text-xs text-primary">URI parsed — fields filled below.</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Paste an <code>otpauth://</code> URI to auto-fill, or enter the Base32 secret
                directly.
              </p>
            )}
          </div>
          <div className="field-group" data-invalid={!!errors.secret}>
            <Label htmlFor="secret">Secret</Label>
            <Input
              id="secret"
              placeholder="JBSWY3DPEHPK3PXP"
              autoComplete="off"
              className="font-mono"
              {...register('secret')}
            />
            <FieldError message={errors.secret?.message} />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div className="field-group">
              <Label htmlFor="issuer" optional>
                Issuer
              </Label>
              <Input id="issuer" placeholder="GitHub" autoComplete="off" {...register('issuer')} />
            </div>
            <div className="field-group">
              <Label htmlFor="accountName" optional>
                Account Name
              </Label>
              <Input
                id="accountName"
                placeholder="user@example.com"
                autoComplete="off"
                {...register('accountName')}
              />
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowTotpAdvanced((v) => !v)}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground active:text-foreground transition-colors py-1 touch-manipulation"
          >
            {showTotpAdvanced ? (
              <ChevronDown className="w-3.5 h-3.5" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5" />
            )}
            Advanced
          </button>
          {showTotpAdvanced && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              <div className="field-group">
                <Label htmlFor="algorithm">Algorithm</Label>
                <select
                  id="algorithm"
                  className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring dark:bg-input/20"
                  {...register('algorithm')}
                >
                  <option value="SHA1">SHA1</option>
                  <option value="SHA256">SHA256</option>
                  <option value="SHA512">SHA512</option>
                </select>
              </div>
              <div className="field-group">
                <Label htmlFor="digits">Digits</Label>
                <select
                  id="digits"
                  className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring dark:bg-input/20"
                  {...register('digits', { valueAsNumber: true })}
                >
                  <option value={6}>6</option>
                  <option value={8}>8</option>
                </select>
              </div>
              <div className="field-group">
                <Label htmlFor="period">Period (s)</Label>
                <Input
                  id="period"
                  type="number"
                  min={15}
                  max={300}
                  {...register('period', { valueAsNumber: true })}
                />
              </div>
            </div>
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
              {...register('notes')}
            />
          </div>
        </>
      )}

      {type === 'developer_credential' && (
        <>
          <div className="field-group" data-invalid={!!errors.credentialMode}>
            <Label htmlFor="credentialMode">Mode</Label>
            <select
              id="credentialMode"
              className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring dark:bg-input/20"
              {...register('credentialMode')}
            >
              <option value="token">Token</option>
              <option value="client_secret_pair">Client ID + Secret</option>
              <option value="ssh_key">SSH keypair</option>
            </select>
            <FieldError message={errors.credentialMode?.message} />
          </div>
          {developerCredentialMode !== 'ssh_key' && (
            <>
              <div className="field-group" data-invalid={!!errors.provider}>
                <Label htmlFor="provider">Provider</Label>
                <Input
                  id="provider"
                  placeholder="OpenAI"
                  autoComplete="off"
                  {...register('provider')}
                />
                <FieldError message={errors.provider?.message} />
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <div className="field-group">
                  <Label htmlFor="environment" optional>
                    Environment
                  </Label>
                  <Input
                    id="environment"
                    placeholder="production"
                    autoComplete="off"
                    {...register('environment')}
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
                    {...register('baseUrl', {
                      setValueAs: (value) =>
                        typeof value === 'string' && value.trim() === '' ? undefined : value,
                    })}
                  />
                  <FieldError message={errors.baseUrl?.message} />
                </div>
              </div>
            </>
          )}
          {developerCredentialMode === 'token' && (
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
                    {...register('secret')}
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
                <Input id="keyId" placeholder="primary" autoComplete="off" {...register('keyId')} />
              </div>
            </>
          )}
          {developerCredentialMode === 'client_secret_pair' && (
            <>
              <div className="field-group" data-invalid={!!errors.clientId}>
                <Label htmlFor="clientId">Client ID</Label>
                <Input
                  id="clientId"
                  placeholder="service-client"
                  autoComplete="off"
                  {...register('clientId')}
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
                    {...register('clientSecret')}
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowClientSecret((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label={showClientSecret ? 'Hide client secret' : 'Show client secret'}
                  >
                    {showClientSecret ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
                <FieldError message={errors.clientSecret?.message} />
              </div>
            </>
          )}
          {developerCredentialMode === 'ssh_key' && (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <div className="field-group" data-invalid={!!errors.username}>
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    placeholder="deploy"
                    autoComplete="off"
                    {...register('username')}
                  />
                  <FieldError message={errors.username?.message} />
                </div>
                <div className="field-group" data-invalid={!!errors.host}>
                  <Label htmlFor="host">Host</Label>
                  <Input
                    id="host"
                    placeholder="bastion.example.com"
                    autoComplete="off"
                    {...register('host')}
                  />
                  <FieldError message={errors.host?.message} />
                </div>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <div className="field-group" data-invalid={!!errors.algorithm}>
                  <Label htmlFor="algorithm" optional>
                    Algorithm
                  </Label>
                  <Input
                    id="algorithm"
                    placeholder="ed25519"
                    autoComplete="off"
                    {...register('algorithm')}
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
                    {...register('fingerprint')}
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
                  {...register('publicKey')}
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
                  {...register('privateKey')}
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
                    {...register('passphrase')}
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowSshPassphrase((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label={showSshPassphrase ? 'Hide passphrase' : 'Show passphrase'}
                  >
                    {showSshPassphrase ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
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
              {...register('notes')}
            />
          </div>
        </>
      )}

      {type === 'crypto_wallet' && (
        <>
          <input type="hidden" {...register('walletMode')} />
          <div className="field-group" data-invalid={!!errors.mnemonic}>
            <Label htmlFor="mnemonic">Seed Phrase</Label>
            <MnemonicGrid
              value={(watch('mnemonic') as string) ?? ''}
              onChange={(v) => setValue('mnemonic', v, { shouldValidate: true })}
              disabled={false}
            />
            <FieldError message={errors.mnemonic?.message} />
          </div>
          <div className="field-group">
            <Label htmlFor="walletPassphrase" optional>
              Passphrase
            </Label>
            <div className="relative">
              <Input
                id="walletPassphrase"
                type={showWalletPassphrase ? 'text' : 'password'}
                autoComplete="off"
                className="pr-9"
                placeholder="Optional 25th-word passphrase"
                {...register('passphrase')}
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowWalletPassphrase((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                aria-label={showWalletPassphrase ? 'Hide passphrase' : 'Show passphrase'}
              >
                {showWalletPassphrase ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
            <p className="text-xs text-muted-foreground flex items-start gap-1">
              <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5 text-yellow-500" />
              Lost passphrase = different wallet, lost funds.
            </p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div className="field-group">
              <Label htmlFor="walletName" optional>
                Wallet Name
              </Label>
              <Input
                id="walletName"
                placeholder="My ETH wallet"
                autoComplete="off"
                {...register('walletName')}
              />
            </div>
            <div className="field-group">
              <Label htmlFor="network" optional>
                Network
              </Label>
              <Input
                id="network"
                placeholder="ethereum"
                autoComplete="off"
                list="network-suggestions"
                {...register('network')}
              />
              <datalist id="network-suggestions">
                <option value="bitcoin" />
                <option value="ethereum" />
                <option value="solana" />
                <option value="cosmos" />
                <option value="polkadot" />
              </datalist>
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div className="field-group" data-invalid={!!errors.derivationPath}>
              <Label htmlFor="derivationPath" optional>
                Derivation Path
              </Label>
              <Input
                id="derivationPath"
                placeholder="m/44'/60'/0'/0/0"
                autoComplete="off"
                className="font-mono text-xs"
                {...register('derivationPath')}
              />
              <FieldError message={errors.derivationPath?.message} />
            </div>
            <div className="field-group" data-invalid={!!errors.addressHint}>
              <Label htmlFor="addressHint" optional>
                Address Hint
              </Label>
              <Input
                id="addressHint"
                placeholder="0x742d35..."
                autoComplete="off"
                maxLength={20}
                className="font-mono text-xs"
                {...register('addressHint')}
              />
              <p className="text-xs text-muted-foreground">First 8–12 chars of derived address.</p>
              <FieldError message={errors.addressHint?.message} />
            </div>
          </div>
          <div className="field-group">
            <Label htmlFor="notes" optional>
              Notes
            </Label>
            <Textarea
              id="notes"
              placeholder="Optional notes"
              autoComplete="off"
              className="min-h-[80px]"
              {...register('notes')}
            />
          </div>
        </>
      )}

      {/* Custom fields */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Custom Fields</Label>
          <button
            type="button"
            onClick={() => append({ label: '', value: '' })}
            className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
          >
            <Plus className="w-3 h-3" />
            Add field
          </button>
        </div>
        {fields.map((field, index) => (
          <div key={field.id} className="flex gap-2 items-start">
            <Input
              placeholder="Label"
              className="w-36 shrink-0"
              {...register(`customFields.${index}.label`)}
            />
            <Input
              placeholder="Value"
              className="flex-1"
              {...register(`customFields.${index}.value`)}
            />
            <button
              type="button"
              onClick={() => remove(index)}
              className="p-2 text-muted-foreground hover:text-destructive transition-colors shrink-0"
              aria-label="Remove field"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      <FieldError message={error ?? undefined} />
      <div className="sticky bottom-0 bg-card pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:static lg:bg-transparent lg:pt-2 border-t border-border/50 lg:border-0 flex gap-2">
        <Button type="button" variant="outline" className="flex-1" onClick={handleCancel}>
          Cancel
        </Button>
        <Button type="submit" className="flex-1" loading={isSubmitting}>
          {submitLabel}
        </Button>
      </div>

      <ResponsiveDialog
        open={showDiscardDialog}
        onOpenChange={setShowDiscardDialog}
        title="Discard changes?"
        description="Your unsaved changes will be lost."
        footer={
          <>
            <Button variant="destructive" onClick={handleConfirmDiscard}>
              Discard
            </Button>
            <Button variant="outline" onClick={() => setShowDiscardDialog(false)}>
              Keep editing
            </Button>
          </>
        }
      />

      <ResponsiveDialog
        open={showModeSwitch !== null}
        onOpenChange={() => setShowModeSwitch(null)}
        title="Switch mode?"
        description="Fields for the current mode will be cleared."
        footer={
          <>
            <Button onClick={handleConfirmModeSwitch}>Switch mode</Button>
            <Button variant="outline" onClick={() => setShowModeSwitch(null)}>
              Keep editing
            </Button>
          </>
        }
      />
    </form>
  );
}
