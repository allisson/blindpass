import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  Check,
  Copy,
  Download,
  Eye,
  EyeOff,
  Fingerprint,
  KeyRound,
  Loader2,
  Lock,
  Monitor,
  Moon,
  Rows3,
  Rows4,
  Shield,
  Smartphone,
  Sun,
  Upload,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import {
  decryptSymmetric,
  encryptSymmetric,
  generateSalt,
  generateKey,
  verificationId,
} from '@blindpass/crypto';
import {
  encryptVaultItem,
  decryptVaultItem,
  exportVaultPlaintext,
  importVaultPlaintext,
} from '@blindpass/vault';
import type { VaultItem as VaultItemData } from '@blindpass/vault';
import { BATCH_CREATE_MAX_ITEMS } from '@blindpass/api-schema';
import { deriveKEK } from '@/lib/kdfWorker';
import { Button } from '@/components/ui/button';
import { FieldError } from '@/components/ui/field-error';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { OtpInput } from '@/components/ui/otp-input';
import { PasswordStrength } from '@/components/ui/password-strength';
import { Separator } from '@/components/ui/separator';
import { api } from '@/lib/api';
import { fromBase64, fromBase64EncryptedValue, toBase64, toBase64EncryptedValue } from '@/lib/b64';
import { MIN_PASSWORD_LENGTH } from '@/lib/constants';
import { session } from '@/lib/session';
import { VAULT_ITEMS_KEY } from '@/hooks/useVault';
import { detectFormat, parseFile } from '@/lib/import';
import type { ImportFormat, ImportResult } from '@/lib/import';
import { applyDensity, loadDensity, type Density } from '@/lib/density';
import { applyTheme, loadTheme } from '@/lib/theme';
import { usePWAInstall } from '@/hooks/usePWAInstall';

export const Route = createFileRoute('/_vault/settings')({
  component: SettingsPage,
});

// ── Appearance ───────────────────────────────────────────────────────────────

const THEME_OPTIONS = [
  { value: 'light', label: 'Light', Icon: Sun },
  { value: 'dark', label: 'Dark', Icon: Moon },
  { value: 'system', label: 'System', Icon: Monitor },
] as const;

function AppearanceSection() {
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>(() => loadTheme());

  function handleTheme(t: 'light' | 'dark' | 'system') {
    setTheme(t);
    applyTheme(t);
    window.dispatchEvent(new CustomEvent('bp:theme-change', { detail: t }));
  }

  return (
    <div className="flex gap-2" role="radiogroup" aria-label="Color theme">
      {THEME_OPTIONS.map(({ value, label, Icon }) => (
        <button
          key={value}
          role="radio"
          aria-checked={theme === value}
          onClick={() => handleTheme(value)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
            theme === value
              ? 'bg-primary/10 border-primary/30 text-primary'
              : 'border-border text-muted-foreground hover:text-foreground hover:border-border/80'
          }`}
        >
          <Icon className="w-3 h-3" aria-hidden="true" />
          {label}
        </button>
      ))}
    </div>
  );
}

// ── Density ──────────────────────────────────────────────────────────────────

const DENSITY_OPTIONS = [
  { value: 'cozy', label: 'Cozy', Icon: Rows3 },
  { value: 'compact', label: 'Compact', Icon: Rows4 },
] as const;

function DensitySection() {
  const [density, setDensity] = useState<Density>(() => loadDensity());

  function handleChange(d: Density) {
    setDensity(d);
    applyDensity(d);
  }

  return (
    <div className="flex gap-2" role="radiogroup" aria-label="Row density">
      {DENSITY_OPTIONS.map(({ value, label, Icon }) => (
        <button
          key={value}
          role="radio"
          aria-checked={density === value}
          onClick={() => handleChange(value)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
            density === value
              ? 'bg-primary/10 border-primary/30 text-primary'
              : 'border-border text-muted-foreground hover:text-foreground hover:border-border/80'
          }`}
        >
          <Icon className="w-3 h-3" aria-hidden="true" />
          {label}
        </button>
      ))}
    </div>
  );
}

// ── Auto-lock ────────────────────────────────────────────────────────────────

const AUTO_LOCK_OPTIONS = [
  { value: 5, label: '5 minutes' },
  { value: 15, label: '15 minutes' },
  { value: 30, label: '30 minutes' },
  { value: 0, label: 'Never' },
] as const;

function AutoLockSection() {
  const [minutes, setMinutes] = useState(() => session.getIdleMinutes());

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = Number(e.target.value);
    setMinutes(val);
    session.setIdleMinutes(val);
  }

  return (
    <select
      value={minutes}
      onChange={handleChange}
      aria-label="Auto-lock timeout"
      className="w-full max-w-xs h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
    >
      {AUTO_LOCK_OPTIONS.map(({ value, label }) => (
        <option key={value} value={value}>
          {label}
        </option>
      ))}
    </select>
  );
}

// ── Verification ID ──────────────────────────────────────────────────────────

function VerificationIdSection() {
  const [id, setId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const pk = session.get()?.keyPair?.publicKey;
    if (!pk) return;
    void verificationId(pk).then(setId);
  }, []);

  async function handleCopy() {
    if (!id) return;
    await navigator.clipboard.writeText(id);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  if (!id) {
    return <p className="text-xs text-muted-foreground">Unlock your vault to view.</p>;
  }

  return (
    <div className="space-y-2">
      <div className="rounded-md bg-muted/40 border border-border p-3 font-mono text-xs leading-relaxed break-words">
        {id}
      </div>
      <Button variant="outline" size="sm" onClick={() => void handleCopy()}>
        {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
        {copied ? 'Copied' : 'Copy'}
      </Button>
      <span role="status" aria-live="polite" className="sr-only">
        {copied ? 'Verification ID copied to clipboard' : ''}
      </span>
    </div>
  );
}

// ── Change Password ──────────────────────────────────────────────────────────

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

const otpSchema = z.object({
  code: z
    .string()
    .length(6)
    .refine((v) => /^\d{6}$/.test(v), 'Must be 6 digits'),
});

type ChangeStep1Data = z.infer<typeof changePasswordStep1Schema>;
type OtpData = z.infer<typeof otpSchema>;

interface PendingChange {
  currentPassword: string;
  newPassword: string;
}

function ChangePasswordSection() {
  const navigate = useNavigate();
  const [pending, setPending] = useState<PendingChange | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingMsg, setLoadingMsg] = useState('');
  const [success, setSuccess] = useState(false);
  const [showFields, setShowFields] = useState({ current: false, new: false, confirm: false });

  const step1Form = useForm<ChangeStep1Data>({
    resolver: standardSchemaResolver(changePasswordStep1Schema),
  });

  const otpForm = useForm<OtpData>({
    resolver: standardSchemaResolver(otpSchema),
    defaultValues: { code: '' },
  });

  const newPasswordValue = step1Form.watch('newPassword', '');

  async function onStep1(data: ChangeStep1Data) {
    setError(null);
    setPending({
      currentPassword: data.currentPassword,
      newPassword: data.newPassword,
    });
  }

  async function onOtp(data: OtpData) {
    if (!pending) return;
    setError(null);
    try {
      setLoadingMsg('Fetching keys…');
      const keysData = await api.getKeys();

      setLoadingMsg('Deriving current key…');
      const currentKekSalt = fromBase64(keysData.kekSalt);
      const currentKEK = await deriveKEK(pending.currentPassword, currentKekSalt);
      const masterKey = await decryptSymmetric(
        fromBase64EncryptedValue(keysData.encryptedMasterKey),
        currentKEK,
      );

      setLoadingMsg('Deriving new key…');
      const newKekSalt = await generateSalt();
      const newKEK = await deriveKEK(pending.newPassword, newKekSalt);
      const newEncryptedMasterKey = await encryptSymmetric(masterKey, newKEK);

      setLoadingMsg('Saving…');
      await api.changePassword({
        authenticatorCode: data.code,
        kekSalt: toBase64(newKekSalt),
        encryptedMasterKey: toBase64EncryptedValue(newEncryptedMasterKey),
      });

      setSuccess(true);
      session.clear();
      setTimeout(() => navigate({ to: '/login' }), 2000);
    } catch (err) {
      setLoadingMsg('');
      setError(err instanceof Error ? err.message : 'Failed to change password');
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
        aria-busy={!!loadingMsg || otpForm.formState.isSubmitting}
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
        <FieldError message={error ?? undefined} />
        <div className="flex gap-2">
          <Button type="submit" size="sm" loading={!!loadingMsg} disabled={!!loadingMsg}>
            {loadingMsg || 'Confirm change'}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setPending(null);
              setError(null);
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
      <FieldError message={error ?? undefined} />
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

// ── Import ───────────────────────────────────────────────────────────────────

type ImportState =
  | { status: 'idle' }
  | { status: 'needs-passphrase'; json: string }
  | { status: 'previewing'; result: ImportResult }
  | { status: 'importing'; done: number; total: number }
  | { status: 'uploading' }
  | { status: 'done'; imported: number; skipped: number }
  | { status: 'error'; message: string };

const FORMAT_LABELS: Record<ImportFormat, string> = {
  chrome: 'Chrome / Firefox',
  lastpass: 'LastPass',
  bitwarden: 'Bitwarden',
  blindpass: 'BlindPass',
};

function ImportSection() {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [format, setFormat] = useState<ImportFormat>('chrome');
  const [autoDetected, setAutoDetected] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [state, setState] = useState<ImportState>({ status: 'idle' });
  const [pending, setPending] = useState<ImportResult | null>(null);
  const [passphrase, setPassphrase] = useState('');
  const [decrypting, setDecrypting] = useState(false);

  function applyFile(file: File) {
    setFileName(file.name);
    const detected = detectFormat(file.name);
    if (detected) {
      setFormat(detected);
      setAutoDetected(true);
    } else {
      setAutoDetected(false);
    }
    setState({ status: 'idle' });
    setPending(null);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) {
      setFileName(null);
      return;
    }
    applyFile(file);
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    // sync dropped file to the input so handlePreview can read it
    const dt = new DataTransfer();
    dt.items.add(file);
    if (fileRef.current) fileRef.current.files = dt.files;
    applyFile(file);
  }

  async function handlePreview() {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    try {
      const raw = await file.text();
      if (format === 'blindpass') {
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        if (parsed['type'] === 'blindpass-export-encrypted') {
          setState({ status: 'needs-passphrase', json: raw });
          return;
        }
        const items = await importVaultPlaintext(raw);
        const result: ImportResult = { items, skipped: 0 };
        setPending(result);
        setState({ status: 'previewing', result });
        return;
      }
      const result = parseFile(format, raw);
      setPending(result);
      setState({ status: 'previewing', result });
    } catch (err) {
      setState({
        status: 'error',
        message: err instanceof Error ? err.message : 'Failed to read file.',
      });
    }
  }

  async function handleDecrypt(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    if (state.status !== 'needs-passphrase') return;
    setDecrypting(true);
    try {
      const parsed = JSON.parse(state.json) as Record<string, unknown>;
      const kekSalt = fromBase64(parsed['kekSalt'] as string);
      const nonce = fromBase64(parsed['nonce'] as string);
      const ciphertext = fromBase64(parsed['ciphertext'] as string);
      // KDF runs in worker so the loading state renders before blocking starts
      const kek = await deriveKEK(passphrase, kekSalt);
      let plaintextBytes: Uint8Array;
      try {
        plaintextBytes = await decryptSymmetric({ ciphertext, nonce }, kek);
      } catch {
        throw new Error('Incorrect passphrase');
      }
      const items = await importVaultPlaintext(new TextDecoder().decode(plaintextBytes));
      const result: ImportResult = { items, skipped: 0 };
      setPending(result);
      setState({ status: 'previewing', result });
    } catch (err) {
      setState({
        status: 'error',
        message: err instanceof Error ? err.message : 'Decryption failed',
      });
    } finally {
      setDecrypting(false);
    }
  }

  async function handleConfirm() {
    const s = session.get();
    if (!s?.keychain || !pending) return;

    const total = pending.items.length;
    const CHUNK_SIZE = BATCH_CREATE_MAX_ITEMS;

    setState({ status: 'importing', done: 0, total });

    const encrypted: {
      encryptedData: ReturnType<typeof toBase64EncryptedValue>;
      encryptedItemKey: ReturnType<typeof toBase64EncryptedValue>;
    }[] = [];

    try {
      for (const item of pending.items) {
        const itemKey = await generateKey();
        const encryptedData = await encryptVaultItem(item, itemKey);
        const encryptedItemKeyVal = await encryptSymmetric(itemKey, s.keychain.vaultKey);
        itemKey.fill(0);
        encrypted.push({
          encryptedData: toBase64EncryptedValue(encryptedData),
          encryptedItemKey: toBase64EncryptedValue(encryptedItemKeyVal),
        });
        setState({ status: 'importing', done: encrypted.length, total });
      }

      setState({ status: 'uploading' });

      for (let i = 0; i < encrypted.length; i += CHUNK_SIZE) {
        await api.batchCreateItems(s.activeVaultId, { items: encrypted.slice(i, i + CHUNK_SIZE) });
      }
    } catch (err) {
      setState({ status: 'error', message: err instanceof Error ? err.message : 'Import failed.' });
      return;
    }

    await qc.invalidateQueries({ queryKey: VAULT_ITEMS_KEY });
    setState({ status: 'done', imported: total, skipped: pending.skipped });
    setPending(null);
    if (fileRef.current) fileRef.current.value = '';
    setFileName(null);
    setAutoDetected(false);
  }

  function handleReset() {
    setState({ status: 'idle' });
    setPending(null);
    setPassphrase('');
    if (fileRef.current) fileRef.current.value = '';
    setFileName(null);
    setAutoDetected(false);
  }

  const busy = state.status === 'importing' || state.status === 'uploading';

  return (
    <div className="space-y-4 max-w-sm">
      <div className="space-y-3">
        {/* Format selector */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="import-format" className="text-xs text-muted-foreground">
              Format
            </label>
            {autoDetected && (
              <span className="text-[10px] font-medium text-primary bg-primary/10 px-1.5 py-px rounded-full">
                auto-detected
              </span>
            )}
          </div>
          <select
            id="import-format"
            value={format}
            onChange={(e) => {
              setFormat(e.target.value as ImportFormat);
              setAutoDetected(false);
            }}
            disabled={busy}
            className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
          >
            <option value="chrome">Chrome / Firefox</option>
            <option value="lastpass">LastPass</option>
            <option value="bitwarden">Bitwarden</option>
            <option value="blindpass">BlindPass</option>
          </select>
        </div>

        {/* Drag-and-drop file zone */}
        <div className="space-y-1.5">
          <label htmlFor="import-file" className="text-xs text-muted-foreground">
            File
          </label>
          <div
            role="button"
            tabIndex={busy ? -1 : 0}
            aria-label={
              fileName ? `Selected file: ${fileName}. Click to change` : 'Choose file to import'
            }
            onDragOver={(e) => {
              e.preventDefault();
              if (!busy) setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={busy ? undefined : handleDrop}
            onClick={() => !busy && fileRef.current?.click()}
            onKeyDown={(e) => {
              if ((e.key === 'Enter' || e.key === ' ') && !busy) {
                e.preventDefault();
                fileRef.current?.click();
              }
            }}
            className={[
              'relative flex flex-col items-center justify-center gap-1.5 rounded-md border-2 border-dashed px-4 py-5 text-center transition-colors cursor-pointer select-none',
              busy ? 'opacity-50 cursor-not-allowed' : 'hover:border-primary/50 hover:bg-primary/5',
              dragOver ? 'border-primary bg-primary/10' : 'border-input',
            ].join(' ')}
          >
            <input
              id="import-file"
              ref={fileRef}
              type="file"
              accept={format === 'blindpass' ? '.json,.blindpass' : '.csv,.json'}
              onChange={handleFileChange}
              disabled={busy}
              className="sr-only"
            />
            <Upload className="w-4 h-4 text-muted-foreground" />
            {fileName ? (
              <p className="text-xs font-medium text-foreground truncate max-w-full px-2">
                {fileName}
              </p>
            ) : (
              <>
                <p className="text-xs text-muted-foreground">
                  Drop file here or{' '}
                  <span className="text-foreground underline underline-offset-2">browse</span>
                </p>
                <p className="text-[10px] text-muted-foreground/60">
                  {format === 'blindpass' ? '.json or .blindpass' : '.csv or .json'}
                </p>
              </>
            )}
          </div>
        </div>
      </div>

      {state.status === 'idle' && (
        <Button size="sm" onClick={handlePreview} disabled={!fileName}>
          Preview import
        </Button>
      )}

      {state.status === 'needs-passphrase' && decrypting && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          Decrypting…
        </div>
      )}

      {state.status === 'needs-passphrase' && !decrypting && (
        <form onSubmit={handleDecrypt} className="space-y-3">
          <div className="field-group">
            <Label htmlFor="imp-pass">Export passphrase</Label>
            <Input
              id="imp-pass"
              type="password"
              autoFocus
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              placeholder="Enter passphrase used during export"
            />
          </div>
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={!passphrase}>
              Decrypt
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={handleReset}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      {state.status === 'previewing' && (
        <div className="rounded-md border p-4 space-y-3">
          <div>
            <p className="text-sm">
              Found <span className="font-medium">{state.result.items.length}</span> item
              {state.result.items.length !== 1 ? 's' : ''} from{' '}
              <span className="font-medium">{FORMAT_LABELS[format]}</span>.
            </p>
            {state.result.skipped > 0 && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {state.result.skipped} skipped (invalid or incomplete).
              </p>
            )}
          </div>
          {state.result.items.length > 0 && (
            <div className="rounded border bg-muted/40 divide-y max-h-36 overflow-y-auto">
              {state.result.items.slice(0, 5).map((item, i) => (
                <div key={i} className="px-3 py-1.5 text-xs truncate text-muted-foreground">
                  {item.title || (item.type === 'login' ? item.url : undefined) || '(untitled)'}
                </div>
              ))}
              {state.result.items.length > 5 && (
                <div className="px-3 py-1.5 text-xs text-muted-foreground/60">
                  +{state.result.items.length - 5} more…
                </div>
              )}
            </div>
          )}
          <div className="flex gap-2">
            <Button size="sm" onClick={handleConfirm} disabled={state.result.items.length === 0}>
              Import {state.result.items.length} item{state.result.items.length !== 1 ? 's' : ''}
            </Button>
            <Button size="sm" variant="ghost" onClick={handleReset}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {state.status === 'importing' && (
        <div className="rounded-md border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Encrypting…</p>
            <span className="text-xs font-mono text-muted-foreground">
              {state.done}/{state.total}
            </span>
          </div>
          <div
            className="h-1.5 rounded-full bg-muted overflow-hidden"
            role="progressbar"
            aria-valuenow={state.total > 0 ? Math.round((state.done / state.total) * 100) : 0}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Import progress"
          >
            <div
              className="h-full bg-primary rounded-full transition-all duration-300"
              style={{ width: state.total > 0 ? `${(state.done / state.total) * 100}%` : '0%' }}
            />
          </div>
        </div>
      )}

      {state.status === 'uploading' && (
        <div className="rounded-md border p-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          Uploading…
        </div>
      )}

      {state.status === 'done' && (
        <div className="rounded-md border border-primary/30 bg-primary/5 p-4 space-y-2">
          <p className="text-sm font-medium">
            {state.imported} item{state.imported !== 1 ? 's' : ''} imported.
          </p>
          {state.skipped > 0 && (
            <p className="text-xs text-muted-foreground">{state.skipped} skipped.</p>
          )}
          <Button size="sm" variant="outline" onClick={handleReset} className="mt-1">
            Import more
          </Button>
        </div>
      )}

      {state.status === 'error' && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 space-y-2">
          <p className="text-sm text-destructive">{state.message}</p>
          <Button size="sm" variant="ghost" onClick={handleReset}>
            Try again
          </Button>
        </div>
      )}
    </div>
  );
}

// ── Export & Import (BlindPass native) ──────────────────────────────────────

function downloadFile(content: string, filename: string) {
  const blob = new Blob([content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

type ExportState =
  | { status: 'idle' }
  | { status: 'confirming-plain' }
  | { status: 'passphrase' }
  | { status: 'exporting'; msg: string }
  | { status: 'done' }
  | { status: 'error'; message: string };

async function fetchAndDecryptAll(): Promise<VaultItemData[]> {
  const s = session.get();
  if (!s?.keychain) throw new Error('Not authenticated');
  const { items } = await api.getItems(s.activeVaultId);
  return Promise.all(
    items.map(async (item) => {
      const itemKey = await decryptSymmetric(
        fromBase64EncryptedValue(item.encryptedItemKey),
        s.keychain!.vaultKey,
      );
      const vaultItem = await decryptVaultItem(
        fromBase64EncryptedValue(item.encryptedData),
        itemKey,
      );
      itemKey.fill(0);
      return vaultItem;
    }),
  );
}

function ExportSection() {
  const [state, setState] = useState<ExportState>({ status: 'idle' });
  const [passphrase, setPassphrase] = useState('');
  const [confirmPassphrase, setConfirmPassphrase] = useState('');
  const [passphraseError, setPassphraseError] = useState('');

  async function handleExportPlain() {
    setState({ status: 'exporting', msg: 'Decrypting vault…' });
    try {
      const items = await fetchAndDecryptAll();
      const json = await exportVaultPlaintext(items);
      downloadFile(json, 'blindpass-export.json');
      setState({ status: 'done' });
    } catch (err) {
      setState({ status: 'error', message: err instanceof Error ? err.message : 'Export failed' });
    }
  }

  async function handleExportEncrypted(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!passphrase) {
      setPassphraseError('Passphrase is required');
      return;
    }
    if (passphrase !== confirmPassphrase) {
      setPassphraseError('Passphrases do not match');
      return;
    }
    setPassphraseError('');
    setState({ status: 'exporting', msg: 'Decrypting vault…' });
    try {
      const items = await fetchAndDecryptAll();
      setState({ status: 'exporting', msg: 'Deriving encryption key…' });
      const plaintext = await exportVaultPlaintext(items);
      const kekSalt = await generateSalt();
      const kek = await deriveKEK(passphrase, kekSalt);
      setState({ status: 'exporting', msg: 'Encrypting…' });
      const encrypted = await encryptSymmetric(new TextEncoder().encode(plaintext), kek);
      const payload = JSON.stringify({
        version: 1,
        type: 'blindpass-export-encrypted',
        kekSalt: toBase64(kekSalt),
        nonce: toBase64(encrypted.nonce),
        ciphertext: toBase64(encrypted.ciphertext),
      });
      downloadFile(payload, 'blindpass-export.blindpass');
      setState({ status: 'done' });
    } catch (err) {
      setState({ status: 'error', message: err instanceof Error ? err.message : 'Export failed' });
    }
  }

  function reset() {
    setState({ status: 'idle' });
    setPassphrase('');
    setConfirmPassphrase('');
    setPassphraseError('');
  }

  if (state.status === 'done') {
    return (
      <div className="rounded-md border border-primary/30 bg-primary/5 p-4 space-y-2">
        <p className="text-sm font-medium">Export complete.</p>
        <Button size="sm" variant="outline" onClick={reset}>
          Export again
        </Button>
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 space-y-2">
        <p className="text-sm text-destructive">{state.message}</p>
        <Button size="sm" variant="ghost" onClick={reset}>
          Try again
        </Button>
      </div>
    );
  }

  if (state.status === 'exporting') {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
        <Loader2 className="w-4 h-4 animate-spin" />
        {state.msg}
      </div>
    );
  }

  if (state.status === 'confirming-plain') {
    return (
      <div
        role="alert"
        className="rounded-md border border-yellow-500/30 bg-yellow-500/5 p-4 space-y-3 max-w-sm"
      >
        <div className="flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-yellow-500 shrink-0 mt-0.5" />
          <p className="text-xs text-yellow-700 dark:text-yellow-400">
            This file will contain all your passwords in plaintext. Store it securely and delete it
            when done.
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={handleExportPlain}>
            Download anyway
          </Button>
          <Button size="sm" variant="ghost" onClick={reset}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  if (state.status === 'passphrase') {
    return (
      <form onSubmit={handleExportEncrypted} className="space-y-3 max-w-sm">
        <div className="field-group">
          <Label htmlFor="exp-pass">Export passphrase</Label>
          <Input
            id="exp-pass"
            type="password"
            autoFocus
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
            placeholder="Enter a strong passphrase"
            aria-invalid={!!passphraseError}
            aria-describedby={passphraseError ? 'exp-passphrase-error' : undefined}
          />
        </div>
        <div className="field-group">
          <Label htmlFor="exp-pass-confirm">Confirm passphrase</Label>
          <Input
            id="exp-pass-confirm"
            type="password"
            value={confirmPassphrase}
            onChange={(e) => setConfirmPassphrase(e.target.value)}
            placeholder="Repeat passphrase"
            aria-invalid={!!passphraseError}
            aria-describedby={passphraseError ? 'exp-passphrase-error' : undefined}
          />
        </div>
        <FieldError id="exp-passphrase-error" message={passphraseError ?? undefined} />
        <div className="flex gap-2">
          <Button type="submit" size="sm">
            Download encrypted
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={reset}>
            Cancel
          </Button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" variant="outline" onClick={() => setState({ status: 'confirming-plain' })}>
        <Download className="w-3.5 h-3.5 mr-1.5" />
        Export as JSON
      </Button>
      <Button size="sm" variant="outline" onClick={() => setState({ status: 'passphrase' })}>
        <Download className="w-3.5 h-3.5 mr-1.5" />
        Export encrypted (.blindpass)
      </Button>
    </div>
  );
}

// ── Delete Account ───────────────────────────────────────────────────────────

function DeleteAccountSection() {
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

// ── Install App ──────────────────────────────────────────────────────────────

function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches;
}

function InstallAppSection() {
  const { canInstall, install } = usePWAInstall();

  if (isStandalone()) {
    return (
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-primary/10 border border-primary/20 text-primary">
          <Check className="w-3 h-3" />
          Already installed
        </span>
      </div>
    );
  }

  if (canInstall) {
    return (
      <Button size="sm" variant="outline" onClick={() => void install()}>
        <Smartphone className="w-3.5 h-3.5 mr-1.5" />
        Install BlindPass
      </Button>
    );
  }

  if (isIOS()) {
    return (
      <p className="text-xs text-muted-foreground">
        Tap the <strong>Share</strong> button in Safari, then choose{' '}
        <strong>Add to Home Screen</strong>.
      </p>
    );
  }

  return (
    <p className="text-xs text-muted-foreground">
      Use your browser's install option (address bar or menu) to add BlindPass to your device.
    </p>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

function SettingsPage() {
  return (
    <motion.div
      className="max-w-xl mx-auto px-6 py-8 space-y-6"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
    >
      <div>
        <h1 className="font-heading text-lg font-semibold tracking-tight text-foreground">
          Settings
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">Manage your account and security.</p>
      </div>

      <section className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
            <Sun className="w-3.5 h-3.5 text-primary" />
          </div>
          <div>
            <h2 className="text-sm font-medium text-foreground">Appearance</h2>
            <p className="text-[11px] text-muted-foreground mt-px">
              Choose your preferred color theme.
            </p>
          </div>
        </div>
        <Separator />
        <AppearanceSection />
      </section>

      <section className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
            <Rows3 className="w-3.5 h-3.5 text-primary" />
          </div>
          <div>
            <h2 className="text-sm font-medium text-foreground">Density</h2>
            <p className="text-[11px] text-muted-foreground mt-px">
              Vertical breathing room in lists.
            </p>
          </div>
        </div>
        <Separator />
        <DensitySection />
      </section>

      <section className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
            <Lock className="w-3.5 h-3.5 text-primary" />
          </div>
          <div>
            <h2 className="text-sm font-medium text-foreground">Auto-lock</h2>
            <p className="text-[11px] text-muted-foreground mt-px">
              Lock the vault after a period of inactivity.
            </p>
          </div>
        </div>
        <Separator />
        <AutoLockSection />
      </section>

      <section className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
            <Fingerprint className="w-3.5 h-3.5 text-primary" />
          </div>
          <div>
            <h2 className="text-sm font-medium text-foreground">Verification ID</h2>
            <p className="text-[11px] text-muted-foreground mt-px">
              Share this 24-word fingerprint with someone before they share a vault with you. They
              should see the same words next to your username in their share dialog.
            </p>
          </div>
        </div>
        <Separator />
        <VerificationIdSection />
      </section>

      <section className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
            <KeyRound className="w-3.5 h-3.5 text-primary" />
          </div>
          <div>
            <h2 className="text-sm font-medium text-foreground">Change master password</h2>
            <p className="text-[11px] text-muted-foreground mt-px">
              Re-encrypts your master key with a new password. All active sessions will be signed
              out.
            </p>
          </div>
        </div>
        <Separator />
        <ChangePasswordSection />
      </section>

      <section className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
            <Upload className="w-3.5 h-3.5 text-primary" />
          </div>
          <div>
            <h2 className="text-sm font-medium text-foreground">Import passwords</h2>
            <p className="text-[11px] text-muted-foreground mt-px">
              Import items from Chrome, Firefox, LastPass, Bitwarden, or a BlindPass export.
            </p>
          </div>
        </div>
        <Separator />
        <ImportSection />
      </section>

      <section className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
            <Download className="w-3.5 h-3.5 text-primary" />
          </div>
          <div>
            <h2 className="text-sm font-medium text-foreground">Export passwords</h2>
            <p className="text-[11px] text-muted-foreground mt-px">
              Export your vault as a backup file.
            </p>
          </div>
        </div>
        <Separator />
        <ExportSection />
      </section>

      <section className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
            <Smartphone className="w-3.5 h-3.5 text-primary" />
          </div>
          <div>
            <h2 className="text-sm font-medium text-foreground">Install app</h2>
            <p className="text-[11px] text-muted-foreground mt-px">
              Add BlindPass to your home screen for quick access.
            </p>
          </div>
        </div>
        <Separator />
        <InstallAppSection />
      </section>

      <section className="rounded-xl border border-destructive/30 bg-destructive/5 p-5 space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-destructive/10 border border-destructive/30 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-3.5 h-3.5 text-destructive" />
          </div>
          <div>
            <h2 className="text-sm font-medium text-destructive">Danger zone</h2>
            <p className="text-[11px] text-muted-foreground mt-px">
              Permanent actions that cannot be undone.
            </p>
          </div>
        </div>
        <Separator className="border-destructive/20" />
        <DeleteAccountSection />
      </section>
    </motion.div>
  );
}
