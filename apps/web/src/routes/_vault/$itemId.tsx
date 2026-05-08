import { Link, createFileRoute, redirect, useNavigate } from '@tanstack/react-router';
import { z } from 'zod';
import type { VaultItem } from '@blindpass/vault';
import { ItemForm } from '@/components/vault/ItemForm';
import { useUpdateItem } from '@/hooks/useVault';
import { useRecentlyViewed } from '@/hooks/useRecentlyViewed';
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  Folder,
  Globe,
  MoreHorizontal,
  PencilLine,
  Trash2,
} from 'lucide-react';
import type { DecryptedItem } from '@/hooks/useVault';
import { toast } from 'sonner';
import { type ReactNode, useState } from 'react';
import { useCopyWithAutoClear } from '@/hooks/useCopyWithAutoClear';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ResponsiveDialog } from '@/components/ui/responsive-dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button, buttonVariants } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useDeleteItem, useMoveItem, useVaultItems } from '@/hooks/useVault';
import { useFolders } from '@/hooks/useFolders';
import { ItemHistory } from '@/components/vault/ItemHistory';
import { TotpCode } from '@/components/vault/TotpCode';
import { getAvatarColor, withAlpha } from '@/lib/avatar';
import { ItemAvatar } from '@/components/vault/ItemAvatar';
import { session } from '@/lib/session';

function getHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

const itemSearchSchema = z.object({
  edit: z.literal('1').optional(),
});

export const Route = createFileRoute('/_vault/$itemId')({
  validateSearch: itemSearchSchema,
  beforeLoad: ({ params, search }) => {
    if (search.edit !== '1') return;
    const s = session.get();
    const isReadOnly = s ? s.vaults.get(s.activeVaultId)?.role === 'viewer' : false;
    if (isReadOnly) {
      throw redirect({ to: '/$itemId', params: { itemId: params.itemId } });
    }
  },
  component: ItemDetailPage,
});

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('Failed to copy');
    }
  }
  return (
    <>
      <button
        onClick={handleCopy}
        className="p-2 rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors shrink-0 touch-manipulation"
        aria-label={copied ? 'Copied' : 'Copy'}
      >
        {copied ? <Check className="w-3.5 h-3.5 text-primary" /> : <Copy className="w-3.5 h-3.5" />}
      </button>
      <span role="status" aria-live="polite" className="sr-only">
        {copied ? 'Copied to clipboard' : ''}
      </span>
    </>
  );
}

function FieldRow({ label, value }: { label: string; value: string }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="px-4 py-3 flex items-center gap-3 hover:bg-accent/40 transition-colors">
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-0.5">
          {label}
        </p>
        <p
          className={`text-sm text-foreground cursor-pointer select-none ${expanded ? 'break-words whitespace-pre-wrap' : 'truncate'}`}
          onClick={() => setExpanded((v) => !v)}
        >
          {value}
        </p>
      </div>
      <CopyButton value={value} />
    </div>
  );
}

function SecureCopyButton({ value, label }: { value: string; label: string }) {
  const [showDialog, setShowDialog] = useState(false);
  const copyWithClear = useCopyWithAutoClear(15000);
  async function handleConfirm() {
    await copyWithClear(value);
    setShowDialog(false);
  }
  return (
    <>
      <button
        onClick={() => setShowDialog(true)}
        className="p-2 rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors shrink-0 touch-manipulation"
        aria-label={`Copy ${label}`}
      >
        <Copy className="w-3.5 h-3.5" />
      </button>
      <ResponsiveDialog
        open={showDialog}
        onOpenChange={setShowDialog}
        title={`Copy ${label}?`}
        description={`${label} will be on clipboard for 15 seconds, then automatically cleared.`}
        footer={
          <>
            <Button onClick={handleConfirm}>Copy</Button>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancel
            </Button>
          </>
        }
      />
    </>
  );
}

function PasswordRow({
  password,
  label = 'Password',
  secureCopy,
}: {
  password: string;
  label?: string;
  secureCopy?: boolean;
}) {
  const [show, setShow] = useState(false);
  const reduceMotion = useReducedMotion();
  return (
    <div className="px-4 py-3 flex items-center gap-3 hover:bg-accent/40 transition-colors">
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-0.5">
          {label}
        </p>
        <AnimatePresence mode="wait" initial={false}>
          <motion.p
            key={show ? 'shown' : 'hidden'}
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={reduceMotion ? {} : { opacity: 0 }}
            transition={reduceMotion ? { duration: 0 } : { duration: 0.15 }}
            className={
              show
                ? 'text-sm font-mono tracking-wider text-primary break-all'
                : 'text-lg tracking-[0.25em] text-muted-foreground leading-none py-0.5'
            }
          >
            {show ? password : '••••••••••••'}
          </motion.p>
        </AnimatePresence>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={() => setShow((s) => !s)}
          className="p-2 rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors touch-manipulation"
          aria-label={show ? 'Hide password' : 'Show password'}
        >
          {show ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
        </button>
        {secureCopy ? (
          <SecureCopyButton value={password} label={label} />
        ) : (
          <CopyButton value={password} />
        )}
      </div>
    </div>
  );
}

function passwordStrength(p: string): number {
  if (!p) return 0;
  let score = 0;
  if (p.length >= 8) score++;
  if (p.length >= 12) score++;
  if (/[A-Z]/.test(p) && /[0-9]/.test(p)) score++;
  if (/[^A-Za-z0-9]/.test(p)) score++;
  return score;
}

const STRENGTH_COLORS = [
  'bg-muted',
  'bg-destructive',
  'bg-amber-500',
  'bg-[var(--accent-teal)]',
  'bg-primary',
];
const STRENGTH_LABELS = ['', 'Weak', 'Fair', 'Good', 'Strong'];

function PasswordStrengthBar({ password }: { password: string }) {
  const score = passwordStrength(password);
  if (!password) return null;
  return (
    <div
      className="px-4 pb-3 -mt-1"
      role="meter"
      aria-valuenow={score}
      aria-valuemin={0}
      aria-valuemax={4}
      aria-label={`Password strength: ${STRENGTH_LABELS[score] || 'None'}`}
    >
      <div className="flex gap-1 mb-1">
        {[1, 2, 3, 4].map((level) => (
          <div
            key={level}
            className={`h-1 flex-1 rounded-full transition-colors ${score >= level ? STRENGTH_COLORS[score] : 'bg-muted'}`}
          />
        ))}
      </div>
      <p className="text-[10px] text-muted-foreground">{STRENGTH_LABELS[score]}</p>
    </div>
  );
}

function SectionLabel({ label }: { label: string }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50 mb-1.5 px-1">
      {label}
    </p>
  );
}

function NotesArea({ notes }: { notes: string }) {
  return (
    <div className="bg-muted/30 rounded-xl px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50 mb-1.5">
        Notes
      </p>
      <div className="max-h-48 overflow-y-auto">
        <p className="text-sm text-foreground whitespace-pre-wrap">{notes}</p>
      </div>
    </div>
  );
}

function FieldCard({ children }: { children: ReactNode }) {
  return (
    <div className="divide-y rounded-2xl overflow-hidden border border-border/60 bg-card">
      {children}
    </div>
  );
}

function ItemFields({ item, color }: { item: DecryptedItem; color: string }) {
  if (item.type === 'login') {
    return (
      <div className="space-y-3">
        <div>
          <SectionLabel label="Credentials" />
          <div
            className="divide-y rounded-2xl overflow-hidden"
            style={{ border: `1px solid ${withAlpha(color, 0.25)}`, background: 'var(--card)' }}
          >
            <FieldRow label="Username" value={item.username} />
            <PasswordRow password={item.password} />
          </div>
          <PasswordStrengthBar password={item.password} />
        </div>
        {item.url && (
          <div>
            <SectionLabel label="Website" />
            <FieldCard>
              <FieldRow label="URL" value={item.url} />
            </FieldCard>
          </div>
        )}
        {item.notes && <NotesArea notes={item.notes} />}
      </div>
    );
  }
  if (item.type === 'secure_note') {
    return <NotesArea notes={item.content} />;
  }
  if (item.type === 'payment_card') {
    return (
      <div className="space-y-3">
        <div>
          <SectionLabel label="Card details" />
          <div
            className="divide-y rounded-2xl overflow-hidden"
            style={{ border: `1px solid ${withAlpha(color, 0.25)}`, background: 'var(--card)' }}
          >
            <FieldRow label="Cardholder" value={item.cardholderName} />
            <PasswordRow password={item.number} label="Card number" />
            <FieldRow label="Expires" value={`${item.expMonth}/${item.expYear}`} />
            {item.cvv && <PasswordRow password={item.cvv} label="CVV" />}
          </div>
        </div>
        {item.notes && <NotesArea notes={item.notes} />}
      </div>
    );
  }
  if (item.type === 'identity') {
    return (
      <div className="space-y-3">
        <div>
          <SectionLabel label="Identity" />
          <div
            className="divide-y rounded-2xl overflow-hidden"
            style={{ border: `1px solid ${withAlpha(color, 0.25)}`, background: 'var(--card)' }}
          >
            <FieldRow label="Name" value={`${item.firstName} ${item.lastName}`} />
            {item.email && <FieldRow label="Email" value={item.email} />}
            {item.phone && <FieldRow label="Phone" value={item.phone} />}
            {item.address && <FieldRow label="Address" value={item.address} />}
            {item.city && <FieldRow label="City" value={item.city} />}
            {item.country && <FieldRow label="Country" value={item.country} />}
          </div>
        </div>
        {item.notes && <NotesArea notes={item.notes} />}
      </div>
    );
  }
  if (item.type === 'totp') {
    return item.notes ? <NotesArea notes={item.notes} /> : null;
  }
  if (item.type === 'developer_credential') {
    return (
      <div className="space-y-3">
        <div>
          <SectionLabel label="Developer credential" />
          <div
            className="divide-y rounded-2xl overflow-hidden"
            style={{ border: `1px solid ${withAlpha(color, 0.25)}`, background: 'var(--card)' }}
          >
            {item.credentialMode === 'token' ? (
              <>
                <FieldRow label="Provider" value={item.provider} />
                {item.environment && <FieldRow label="Environment" value={item.environment} />}
                <PasswordRow password={item.secret} label="Secret" />
                {item.keyId && <FieldRow label="Key ID" value={item.keyId} />}
              </>
            ) : item.credentialMode === 'client_secret_pair' ? (
              <>
                <FieldRow label="Provider" value={item.provider} />
                {item.environment && <FieldRow label="Environment" value={item.environment} />}
                <FieldRow label="Client ID" value={item.clientId} />
                <PasswordRow password={item.clientSecret} label="Client secret" />
              </>
            ) : (
              <>
                <FieldRow label="Username" value={item.username} />
                <FieldRow label="Host" value={item.host} />
                {item.algorithm && <FieldRow label="Algorithm" value={item.algorithm} />}
                {item.fingerprint && <FieldRow label="Fingerprint" value={item.fingerprint} />}
                <FieldRow label="Public key" value={item.publicKey} />
                <PasswordRow password={item.privateKey} label="Private key" />
                {item.passphrase && <PasswordRow password={item.passphrase} label="Passphrase" />}
              </>
            )}
          </div>
        </div>
        {item.credentialMode !== 'ssh_key' && item.baseUrl && (
          <div>
            <SectionLabel label="Endpoint" />
            <FieldCard>
              <FieldRow label="Base URL" value={item.baseUrl} />
            </FieldCard>
          </div>
        )}
        {item.notes && <NotesArea notes={item.notes} />}
      </div>
    );
  }
  if (item.type === 'crypto_wallet') {
    return (
      <div className="space-y-3">
        <div>
          <SectionLabel label="Wallet" />
          <div
            className="divide-y rounded-2xl overflow-hidden"
            style={{ border: `1px solid ${withAlpha(color, 0.25)}`, background: 'var(--card)' }}
          >
            <PasswordRow password={item.mnemonic} label="Seed phrase" secureCopy />
            {item.passphrase && (
              <PasswordRow password={item.passphrase} label="Passphrase" secureCopy />
            )}
            {item.walletName && <FieldRow label="Wallet name" value={item.walletName} />}
            {item.network && <FieldRow label="Network" value={item.network} />}
            {item.derivationPath && (
              <FieldRow label="Derivation path" value={item.derivationPath} />
            )}
            {item.addressHint && <FieldRow label="Address hint" value={item.addressHint} />}
          </div>
        </div>
        {item.notes && <NotesArea notes={item.notes} />}
      </div>
    );
  }
  return null;
}

function ItemDetailPage() {
  const { itemId } = Route.useParams();
  const search = Route.useSearch();
  const isEditing = search.edit === '1';
  const navigate = useNavigate();
  const { data: items, isLoading } = useVaultItems();
  const { data: folders = [] } = useFolders();
  const deleteItem = useDeleteItem();
  const moveItem = useMoveItem();
  const updateItem = useUpdateItem();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [folderPopoverOpen, setFolderPopoverOpen] = useState(false);
  const s = session.get();
  const isReadOnly = s ? s.vaults.get(s.activeVaultId)?.role === 'viewer' : false;
  const reduceMotion = useReducedMotion();

  useRecentlyViewed(itemId);

  function exitEditMode() {
    navigate({ to: '/$itemId', params: { itemId }, search: {} });
  }

  function enterEditMode() {
    navigate({ to: '/$itemId', params: { itemId }, search: { edit: '1' } });
  }

  async function handleEditSubmit(data: VaultItem) {
    await updateItem.mutateAsync({ id: itemId, vaultItem: data });
    toast.success('Changes saved');
    exitEditMode();
  }

  if (isLoading) {
    return (
      <div className="p-6 max-w-2xl">
        <div className="flex items-center gap-4 mb-6">
          <Skeleton className="w-14 h-14 rounded-2xl" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>
        <Skeleton className="h-36 rounded-xl" />
      </div>
    );
  }

  const item = items?.find((i) => i.id === itemId);
  if (!item) {
    return (
      <div className="h-full p-6 flex flex-col items-center justify-center gap-3 text-center">
        <p className="text-sm text-muted-foreground">Item not found.</p>
        <Link to="/" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
          Back to vault
        </Link>
      </div>
    );
  }

  const color = getAvatarColor(item.title);
  const itemUrl =
    item.type === 'login'
      ? item.url
      : item.type === 'developer_credential' && item.credentialMode !== 'ssh_key'
        ? item.baseUrl
        : undefined;
  const currentFolder = item.folderId ? folders.find((f) => f.id === item.folderId) : undefined;

  async function handleDelete() {
    await deleteItem.mutateAsync(itemId);
    toast.success('Moved to trash');
    navigate({ to: '/' });
  }

  async function handleMoveToFolder(folderId: string | null) {
    await moveItem.mutateAsync({ id: itemId, folderId });
    setFolderPopoverOpen(false);
  }

  return (
    <motion.div
      key={itemId}
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduceMotion ? { duration: 0 } : { duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      className="h-full overflow-auto"
    >
      <div
        data-testid="item-action-bar"
        className="sticky top-0 z-20 backdrop-blur-md bg-background/80 border-b border-border/50 px-4 lg:px-6 py-2 flex items-center gap-2"
      >
        <Link
          to="/"
          aria-label="Back to vault"
          className="lg:hidden p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/40 active:bg-accent/40 transition-colors shrink-0 touch-manipulation"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <span className="font-heading text-sm font-medium text-foreground truncate flex-1">
          {item.title}
        </span>
        <span className="hidden lg:inline-flex items-center text-[10px] uppercase font-mono text-muted-foreground/70 bg-muted px-1.5 py-px rounded">
          {item.type.replace('_', ' ')}
        </span>
        {!isReadOnly && !isEditing && (
          <>
            <Button
              size="sm"
              variant="default"
              data-testid="action-bar-edit"
              aria-label="Edit item"
              onClick={enterEditMode}
              className="h-7 gap-1"
            >
              <PencilLine className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">Edit</span>
            </Button>
            <Popover>
              <PopoverTrigger
                data-testid="action-bar-more"
                aria-label="More actions"
                className={buttonVariants({ variant: 'ghost', size: 'icon-sm' }) + ' h-7 w-7'}
              >
                <MoreHorizontal className="w-4 h-4" />
              </PopoverTrigger>
              <PopoverContent align="end" className="w-44 p-1">
                <button
                  data-testid="action-bar-delete"
                  onClick={() => setShowDeleteDialog(true)}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-destructive hover:bg-destructive/10 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Move to trash
                </button>
              </PopoverContent>
            </Popover>
          </>
        )}
        {isEditing && (
          <span className="text-[10px] uppercase font-mono text-primary bg-primary/10 px-1.5 py-px rounded">
            Editing
          </span>
        )}
      </div>
      {isEditing ? (
        <div className="p-4 md:p-6 max-w-2xl">
          <div className="rounded-lg border border-border bg-card p-4 md:p-6">
            <ItemForm
              key={item.id}
              type={item.type}
              defaultValues={item}
              onSubmit={handleEditSubmit}
              onCancel={exitEditMode}
              submitLabel="Save changes"
            />
          </div>
        </div>
      ) : (
        <div className="p-6 max-w-2xl">
          {/* Gradient header */}
          <div
            className="relative -mx-6 -mt-6 mb-6 px-6 pt-8 pb-5"
            style={{
              background: `linear-gradient(180deg, ${withAlpha(color, 0.1)} 0%, transparent 100%)`,
            }}
          >
            <div className="flex items-start gap-4">
              <ItemAvatar item={item} size="lg" />
              <div className="flex-1 min-w-0 pt-1.5">
                <h1 className="text-xl font-semibold tracking-tight text-foreground">
                  {item.title}
                </h1>
                <div className="flex flex-wrap items-center gap-2 mt-1.5">
                  {itemUrl && (
                    <a
                      href={itemUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-0.5 text-xs text-muted-foreground hover:text-foreground hover:border-border/80 transition-colors"
                    >
                      <Globe className="w-3 h-3" />
                      {getHostname(itemUrl)}
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  )}
                  {isReadOnly ? (
                    currentFolder && (
                      <span
                        data-testid="item-folder"
                        className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-0.5 text-xs text-muted-foreground"
                      >
                        <Folder className="w-3 h-3" />
                        {currentFolder.name}
                      </span>
                    )
                  ) : (
                    <Popover open={folderPopoverOpen} onOpenChange={setFolderPopoverOpen}>
                      <PopoverTrigger
                        data-testid="move-folder-trigger"
                        className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-0.5 text-xs text-muted-foreground hover:text-foreground hover:border-border/80 transition-colors"
                      >
                        <Folder className="w-3 h-3" />
                        {currentFolder ? currentFolder.name : 'No folder'}
                        <ChevronDown className="w-2.5 h-2.5" />
                      </PopoverTrigger>
                      <PopoverContent
                        data-testid="folder-popover-content"
                        align="start"
                        className="w-40 p-1"
                      >
                        <button
                          data-testid="move-folder-none"
                          onClick={() => void handleMoveToFolder(null)}
                          className={`w-full text-left px-2 py-1.5 rounded text-xs transition-colors ${
                            !item.folderId
                              ? 'bg-primary/10 text-primary'
                              : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                          }`}
                        >
                          No folder
                        </button>
                        {folders.map((f) => (
                          <button
                            key={f.id}
                            data-testid={`move-folder-option-${f.id}`}
                            onClick={() => void handleMoveToFolder(f.id)}
                            className={`w-full text-left px-2 py-1.5 rounded text-xs transition-colors ${
                              item.folderId === f.id
                                ? 'bg-primary/10 text-primary'
                                : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                            }`}
                          >
                            {f.name}
                          </button>
                        ))}
                      </PopoverContent>
                    </Popover>
                  )}
                </div>
              </div>
            </div>
          </div>

          {item.type === 'totp' && <TotpCode item={item} />}
          <div className="space-y-3">
            <ItemFields item={item} color={color} />
            {(item.customFields?.length ?? 0) > 0 && (
              <div>
                <SectionLabel label="Custom fields" />
                <div
                  className="divide-y rounded-2xl overflow-hidden"
                  style={{
                    border: `1px solid ${withAlpha(color, 0.25)}`,
                    background: 'var(--card)',
                  }}
                >
                  {item.customFields!.map((f, i) => (
                    <FieldRow key={i} label={f.label} value={f.value} />
                  ))}
                </div>
              </div>
            )}
          </div>

          <ItemHistory itemId={itemId} />
        </div>
      )}

      <ResponsiveDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title="Move to trash?"
        description={
          <>
            <strong>{item.title}</strong> will be moved to the trash. You can restore it or
            permanently delete it from there.
          </>
        }
        footer={
          <>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteItem.isPending}>
              {deleteItem.isPending ? 'Moving…' : 'Move to trash'}
            </Button>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
          </>
        }
      />
    </motion.div>
  );
}
