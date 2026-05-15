import { useSyncBoundary } from '@/components/sync/SyncBoundary';
import { Loader2, Upload, Vault } from 'lucide-react';
import { useRef, useState } from 'react';
import { decryptSymmetric } from '@blindpass/crypto';
import { importVaultPlaintext } from '@blindpass/vault';
import { BATCH_CREATE_MAX_ITEMS } from '@blindpass/api-schema';
import { deriveKEK } from '@/lib/kdfWorker';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { PasswordInput } from '@/components/ui/password-input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { api } from '@/lib/api';
import { fromBase64 } from '@/lib/b64';
import { detectFormat, parseFile } from '@/lib/import';
import type { ImportFormat, ImportResult } from '@/lib/import';
import { useKeychain } from '@/components/keychain/KeychainRequired';

type ImportState =
  | { status: 'idle' }
  | { status: 'needs-passphrase'; json: string }
  | { status: 'previewing'; result: ImportResult }
  | { status: 'importing'; done: number; total: number }
  | { status: 'uploading' }
  | { status: 'done'; imported: number; skipped: number; attachmentsDropped: number }
  | { status: 'error'; message: string };

const FORMAT_LABELS: Record<ImportFormat, string> = {
  chrome: 'Chrome / Firefox',
  lastpass: 'LastPass',
  bitwarden: 'Bitwarden',
  blindpass: 'BlindPass',
  '1password': '1Password',
  dashlane: 'Dashlane',
  'apple-keychain': 'Apple Keychain',
  keepassxc: 'KeePassXC',
  protonpass: 'Proton Pass',
};

export function ImportSection() {
  const k = useKeychain();
  const sync = useSyncBoundary();
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [format, setFormat] = useState<ImportFormat>('chrome');
  const [autoDetected, setAutoDetected] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [state, setState] = useState<ImportState>({ status: 'idle' });
  const [pending, setPending] = useState<ImportResult | null>(null);
  const [passphrase, setPassphrase] = useState('');
  const [decrypting, setDecrypting] = useState(false);
  const [selectedVaultId, setSelectedVaultId] = useState(k.activeVaultId);

  const writableVaults = Array.from(k.vaults.entries())
    .filter(([, v]) => !v.isShared || v.role === 'editor')
    .sort(([a], [b]) => (a === k.activeVaultId ? -1 : b === k.activeVaultId ? 1 : 0))
    .map(([id, v]) => ({
      id,
      name: v.name,
      ownerSuffix: v.isShared && v.ownerUsername ? `shared by ${v.ownerUsername}` : null,
      isActive: id === k.activeVaultId,
    }));

  const selectedVaultName = k.vaults.get(selectedVaultId)?.name ?? '';

  async function applyFile(file: File) {
    setFileName(file.name);
    const detected = await detectFormat(file);
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
    void applyFile(file);
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    const dt = new DataTransfer();
    dt.items.add(file);
    if (fileRef.current) fileRef.current.files = dt.files;
    void applyFile(file);
  }

  async function handlePreview() {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    try {
      if (format === 'blindpass') {
        const raw = await file.text();
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        if (parsed['type'] === 'blindpass-export-encrypted') {
          setState({ status: 'needs-passphrase', json: raw });
          return;
        }
      }
      const result = await parseFile(format, file);
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
      const kek = await deriveKEK(passphrase, kekSalt);
      let plaintextBytes: Uint8Array;
      try {
        plaintextBytes = await decryptSymmetric({ ciphertext, nonce }, kek);
      } catch {
        throw new Error('Incorrect passphrase');
      }
      const items = await importVaultPlaintext(new TextDecoder().decode(plaintextBytes));
      const result: ImportResult = { items, skipped: 0, attachmentsDropped: 0 };
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
    if (!pending) return;

    const total = pending.items.length;
    const CHUNK_SIZE = BATCH_CREATE_MAX_ITEMS;

    setState({ status: 'importing', done: 0, total });

    const vaultKey = k.getVaultKey(selectedVaultId);
    const encrypted: {
      encryptedData: { ciphertext: string; nonce: string };
      encryptedItemKey: { ciphertext: string; nonce: string };
    }[] = [];

    try {
      for (const item of pending.items) {
        const wire = await k.encryptItem(item, vaultKey);
        encrypted.push(wire);
        setState({ status: 'importing', done: encrypted.length, total });
      }

      setState({ status: 'uploading' });

      for (let i = 0; i < encrypted.length; i += CHUNK_SIZE) {
        await api.batchCreateItems(selectedVaultId, { items: encrypted.slice(i, i + CHUNK_SIZE) });
      }
    } catch (err) {
      setState({ status: 'error', message: err instanceof Error ? err.message : 'Import failed.' });
      return;
    }

    void sync.forceSync();
    setState({
      status: 'done',
      imported: total,
      skipped: pending.skipped,
      attachmentsDropped: pending.attachmentsDropped,
    });
    setPending(null);
    if (fileRef.current) fileRef.current.value = '';
    setFileName(null);
    setAutoDetected(false);
  }

  function handleReset() {
    setState({ status: 'idle' });
    setPending(null);
    setPassphrase('');
    setSelectedVaultId(k.activeVaultId);
    if (fileRef.current) fileRef.current.value = '';
    setFileName(null);
    setAutoDetected(false);
  }

  function resetError() {
    if (pending) {
      setState({ status: 'previewing', result: pending });
    } else {
      setState({ status: 'idle' });
      setPassphrase('');
    }
  }

  const busy =
    state.status === 'importing' ||
    state.status === 'uploading' ||
    state.status === 'needs-passphrase';

  return (
    <div className="space-y-4 max-w-sm">
      <div className="space-y-3">
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
          <Select
            value={format}
            onValueChange={(v) => {
              setFormat(v as ImportFormat);
              setAutoDetected(false);
            }}
            disabled={busy}
          >
            <SelectTrigger id="import-format" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="chrome">Chrome / Firefox</SelectItem>
              <SelectItem value="lastpass">LastPass</SelectItem>
              <SelectItem value="bitwarden">Bitwarden</SelectItem>
              <SelectItem value="blindpass">BlindPass</SelectItem>
              <SelectItem value="1password">1Password</SelectItem>
              <SelectItem value="dashlane">Dashlane</SelectItem>
              <SelectItem value="apple-keychain">Apple Keychain</SelectItem>
              <SelectItem value="keepassxc">KeePassXC</SelectItem>
              <SelectItem value="protonpass">Proton Pass</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {writableVaults.length > 1 && (
          <div className="space-y-1.5">
            <label htmlFor="import-vault" className="text-xs text-muted-foreground">
              Destination vault
            </label>
            <Select
              value={selectedVaultId}
              onValueChange={(v) => v && setSelectedVaultId(v)}
              disabled={busy}
            >
              <SelectTrigger id="import-vault" className="w-full">
                <Vault className="size-3.5 text-muted-foreground" />
                <SelectValue>
                  <span title={selectedVaultName}>{selectedVaultName}</span>
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {writableVaults.map(({ id, name, ownerSuffix, isActive }) => (
                  <SelectItem key={id} value={id}>
                    <span>{name}</span>
                    {ownerSuffix && (
                      <span className="text-muted-foreground text-xs">({ownerSuffix})</span>
                    )}
                    {isActive && (
                      <Badge variant="secondary" className="ml-auto h-4 px-1.5 text-[10px]">
                        Active
                      </Badge>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

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
              accept=".csv,.json,.blindpass,.1pux,.zip"
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
                  CSV, JSON, .blindpass, .1pux or .zip
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
            <Label htmlFor="imp-pass">Decryption passphrase</Label>
            <PasswordInput
              id="imp-pass"
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
            {state.result.attachmentsDropped > 0 && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {state.result.attachmentsDropped} attachment
                {state.result.attachmentsDropped !== 1 ? 's' : ''} could not be imported (BlindPass
                does not support file attachments).
              </p>
            )}
          </div>
          {state.result.items.length > 0 && (
            <div className="rounded border bg-muted/40 divide-y max-h-36 overflow-y-auto">
              {state.result.items.slice(0, 5).map((item, i) => (
                <div
                  key={`${item.title}-${i}`}
                  className="px-3 py-1.5 text-xs truncate text-muted-foreground"
                >
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
          {state.attachmentsDropped > 0 && (
            <p className="text-xs text-muted-foreground">
              {state.attachmentsDropped} attachment
              {state.attachmentsDropped !== 1 ? 's' : ''} could not be imported (BlindPass does not
              support file attachments).
            </p>
          )}
          <Button size="sm" variant="outline" onClick={handleReset} className="mt-1">
            Import more
          </Button>
        </div>
      )}

      {state.status === 'error' && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 space-y-2">
          <p className="text-sm text-destructive">{state.message}</p>
          <Button size="sm" variant="ghost" onClick={resetError}>
            Try again
          </Button>
        </div>
      )}
    </div>
  );
}
