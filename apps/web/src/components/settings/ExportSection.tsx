import { AlertTriangle, Download, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { encryptSymmetric, generateSalt } from '@blindpass/crypto';
import { exportVaultPlaintext } from '@blindpass/vault';
import type { VaultItem as VaultItemData } from '@blindpass/vault';
import { deriveKEK } from '@/lib/kdfWorker';
import { Button } from '@/components/ui/button';
import { FieldError } from '@/components/ui/field-error';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toBase64 } from '@/lib/b64';
import { vaultCache } from '@/lib/vaultCache';
import { useKeychain } from '@/components/keychain/KeychainRequired';

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

async function fetchAndDecryptAll(k: ReturnType<typeof useKeychain>): Promise<VaultItemData[]> {
  const cached = await vaultCache.getItems(k.activeVaultId);
  const decrypted = await Promise.all(cached.map((item) => k.decryptItem(item)));
  return decrypted.map((d) => {
    const {
      id: _id,
      folderId: _folderId,
      createdAt: _createdAt,
      updatedAt: _updatedAt,
      ...payload
    } = d;
    void _id;
    void _folderId;
    void _createdAt;
    void _updatedAt;
    return payload as unknown as VaultItemData;
  });
}

export function ExportSection() {
  const k = useKeychain();
  const [state, setState] = useState<ExportState>({ status: 'idle' });
  const [passphrase, setPassphrase] = useState('');
  const [confirmPassphrase, setConfirmPassphrase] = useState('');
  const [passphraseError, setPassphraseError] = useState('');

  async function handleExportPlain() {
    setState({ status: 'exporting', msg: 'Decrypting vault…' });
    try {
      const items = await fetchAndDecryptAll(k);
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
      const items = await fetchAndDecryptAll(k);
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
