import { AlertTriangle, Download, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { encryptSymmetric, generateSalt } from '@blindpass/crypto';
import { VaultItemSchema, exportVaultPlaintext } from '@blindpass/vault';
import type { VaultItem } from '@blindpass/vault';
import { deriveKEK } from '@/lib/kdfWorker';
import { Button } from '@/components/ui/button';
import { FieldError } from '@/components/ui/field-error';
import { Label } from '@/components/ui/label';
import { PasswordInput } from '@/components/ui/password-input';
import { PasswordStrength } from '@/components/ui/password-strength';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toBase64 } from '@/lib/b64';
import { vaultCache } from '@/lib/vaultCache';
import { useKeychain } from '@/components/keychain/KeychainRequired';

function downloadFile(content: string, filename: string) {
  const blob = new Blob([content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 100);
}

type ExportState =
  | { status: 'idle' }
  | { status: 'confirming-plain' }
  | { status: 'passphrase' }
  | { status: 'exporting'; msg: string }
  | { status: 'done'; itemCount: number; vaultName: string }
  | { status: 'error'; message: string };

async function fetchAndDecryptAll(
  k: ReturnType<typeof useKeychain>,
  vaultId: string,
): Promise<VaultItem[]> {
  const cached = await vaultCache.getItems(vaultId);
  const vaultKey = k.getVaultKey(vaultId);
  const decrypted = await Promise.all(cached.map((item) => k.decryptItem(item, vaultKey)));
  return decrypted.map((d) => VaultItemSchema.parse(d));
}

export function ExportSection() {
  const k = useKeychain();
  const [state, setState] = useState<ExportState>({ status: 'idle' });
  const [passphrase, setPassphrase] = useState('');
  const [confirmPassphrase, setConfirmPassphrase] = useState('');
  const [passphraseError, setPassphraseError] = useState('');
  const [selectedVaultId, setSelectedVaultId] = useState(k.activeVaultId);

  const allVaults = Array.from(k.vaults.entries())
    .sort(([a], [b]) => (a === k.activeVaultId ? -1 : b === k.activeVaultId ? 1 : 0))
    .map(([id, v]) => ({
      id,
      label: v.isShared && v.ownerUsername ? `${v.name} (shared by ${v.ownerUsername})` : v.name,
    }));

  const selectedVaultName = k.vaults.get(selectedVaultId)?.name ?? '';
  const vaultSlug =
    selectedVaultName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'vault';

  async function handleExportPlain() {
    setState({ status: 'exporting', msg: 'Decrypting vault…' });
    try {
      const items = await fetchAndDecryptAll(k, selectedVaultId);
      const json = await exportVaultPlaintext(items);
      downloadFile(json, `blindpass-export-${vaultSlug}.json`);
      setState({ status: 'done', itemCount: items.length, vaultName: selectedVaultName });
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
      const items = await fetchAndDecryptAll(k, selectedVaultId);
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
      downloadFile(payload, `blindpass-export-${vaultSlug}.blindpass`);
      setState({ status: 'done', itemCount: items.length, vaultName: selectedVaultName });
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

  function resetError() {
    setState({ status: 'idle' });
    setPassphraseError('');
  }

  if (state.status === 'done') {
    return (
      <div className="rounded-md border border-primary/30 bg-primary/5 p-4 space-y-2">
        <p className="text-sm font-medium">
          {state.itemCount} item{state.itemCount !== 1 ? 's' : ''} exported from{' '}
          <span className="font-semibold">{state.vaultName}</span>.
        </p>
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
        <Button size="sm" variant="ghost" onClick={resetError}>
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
            Export plaintext
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
          <PasswordInput
            id="exp-pass"
            autoFocus
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
            placeholder="Enter a strong passphrase"
            aria-invalid={!!passphraseError}
            aria-describedby={passphraseError ? 'exp-passphrase-error' : undefined}
          />
          <PasswordStrength password={passphrase} />
        </div>
        <div className="field-group">
          <Label htmlFor="exp-pass-confirm">Confirm passphrase</Label>
          <PasswordInput
            id="exp-pass-confirm"
            value={confirmPassphrase}
            onChange={(e) => setConfirmPassphrase(e.target.value)}
            placeholder="Repeat passphrase"
            aria-invalid={!!passphraseError}
            aria-describedby={passphraseError ? 'exp-passphrase-error' : undefined}
          />
        </div>
        <FieldError id="exp-passphrase-error" message={passphraseError || undefined} />
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
    <div className="space-y-3 max-w-sm">
      {allVaults.length > 1 && (
        <div className="space-y-1.5">
          <label htmlFor="export-vault" className="text-xs text-muted-foreground">
            Vault
          </label>
          <Select value={selectedVaultId} onValueChange={(v) => v && setSelectedVaultId(v)}>
            <SelectTrigger id="export-vault" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {allVaults.map(({ id, label }) => (
                <SelectItem key={id} value={id}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => setState({ status: 'confirming-plain' })}
        >
          <Download className="w-3.5 h-3.5 mr-1.5" />
          Export as JSON
        </Button>
        <Button size="sm" variant="outline" onClick={() => setState({ status: 'passphrase' })}>
          <Download className="w-3.5 h-3.5 mr-1.5" />
          Export encrypted (.blindpass)
        </Button>
      </div>
    </div>
  );
}
