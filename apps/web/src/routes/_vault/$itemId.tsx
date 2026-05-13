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
        className="p-1.5 rounded text-muted-foreground hover:text-foreground transition-colors shrink-0 touch-manipulation"
        aria-label={copied ? 'Copied' : 'Copy'}
      >
        {copied ? <Check className="w-4 h-4 text-primary" /> : <Copy className="w-4 h-4" />}
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
    <div className="px-4 py-[14px] flex items-center relative">
      <div className="flex-1 min-w-0 pr-9">
        <p className="text-[10px] font-bold tracking-[0.1em] uppercase text-muted-foreground mb-1.5">
          {label}
        </p>
        <p
          className={`text-[15px] font-medium text-foreground tracking-[0.01em] cursor-pointer select-none ${expanded ? 'break-words whitespace-pre-wrap' : 'truncate'}`}
          onClick={() => setExpanded((v) => !v)}
        >
          {value}
        </p>
      </div>
      <div className="absolute right-3 top-1/2 -translate-y-1/2">
        <CopyButton value={value} />
      </div>
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
        className="p-1.5 rounded text-muted-foreground hover:text-foreground transition-colors shrink-0 touch-manipulation"
        aria-label={`Copy ${label}`}
      >
        <Copy className="w-4 h-4" />
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

function passwordStrength(p: string): number {
  if (!p) return 0;
  let score = 0;
  if (p.length >= 8) score++;
  if (p.length >= 12) score++;
  if (/[A-Z]/.test(p) && /[0-9]/.test(p)) score++;
  if (/[^A-Za-z0-9]/.test(p)) score++;
  return score;
}

const STRENGTH_LABELS = ['', 'Weak', 'Fair', 'Good', 'Strong'];

function PasswordRow({
  password,
  label = 'Password',
  secureCopy,
  showStrength,
}: {
  password: string;
  label?: string;
  secureCopy?: boolean;
  showStrength?: boolean;
}) {
  const [show, setShow] = useState(false);
  const reduceMotion = useReducedMotion();
  const score = passwordStrength(password);

  return (
    <div className="px-4 py-[14px] relative">
      <div className="pr-20">
        <p className="text-[10px] font-bold tracking-[0.1em] uppercase text-muted-foreground mb-1.5">
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
                ? 'text-[15px] font-mono tracking-[0.06em] text-primary break-all'
                : 'text-[18px] tracking-[3px] text-foreground leading-none pt-0.5'
            }
          >
            {show ? password : '••••••••••••'}
          </motion.p>
        </AnimatePresence>
        {showStrength && password && (
          <div className="mt-2.5">
            <div
              className="pw-strength mb-1.5"
              data-score={score}
              role="meter"
              aria-valuenow={score}
              aria-valuemin={0}
              aria-valuemax={4}
              aria-label={`Password strength: ${STRENGTH_LABELS[score] || 'None'}`}
            >
              <span />
              <span />
              <span />
              <span />
            </div>
            <p className="text-[11px] font-semibold text-primary tracking-[0.06em]">
              {STRENGTH_LABELS[score]}
            </p>
          </div>
        )}
      </div>
      <div className="absolute right-3 top-[18px] flex items-center gap-0.5">
        <button
          onClick={() => setShow((s) => !s)}
          className="p-1.5 rounded text-muted-foreground hover:text-foreground transition-colors touch-manipulation"
          aria-label={show ? 'Hide password' : 'Show password'}
        >
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
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

function SectionLabel({ label }: { label: string }) {
  return (
    <p className="text-[11px] font-bold tracking-[0.1em] uppercase text-muted-foreground pt-4 pb-2.5">
      {label}
    </p>
  );
}

function NotesArea({ notes }: { notes: string }) {
  return (
    <div className="bg-card border border-border rounded px-4 py-3 mt-3">
      <p className="text-[10px] font-bold tracking-[0.1em] uppercase text-muted-foreground mb-2">
        Notes
      </p>
      <div className="max-h-48 overflow-y-auto">
        <p className="text-[15px] font-medium text-foreground whitespace-pre-wrap">{notes}</p>
      </div>
    </div>
  );
}

function CredCard({ children }: { children: ReactNode }) {
  return (
    <div className="bg-card border border-border rounded overflow-hidden divide-y">{children}</div>
  );
}

function ItemFields({ item }: { item: DecryptedItem }) {
  if (item.type === 'login') {
    return (
      <div>
        <SectionLabel label="Credentials" />
        <CredCard>
          <FieldRow label="Username" value={item.username} />
          <PasswordRow password={item.password} showStrength />
        </CredCard>
        {item.url && (
          <>
            <SectionLabel label="Website" />
            <CredCard>
              <FieldRow label="URL" value={item.url} />
            </CredCard>
          </>
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
      <div>
        <SectionLabel label="Card details" />
        <CredCard>
          <FieldRow label="Cardholder" value={item.cardholderName} />
          <PasswordRow password={item.number} label="Card number" />
          <FieldRow label="Expires" value={`${item.expMonth}/${item.expYear}`} />
          {item.cvv && <PasswordRow password={item.cvv} label="CVV" />}
        </CredCard>
        {item.notes && <NotesArea notes={item.notes} />}
      </div>
    );
  }
  if (item.type === 'identity') {
    return (
      <div>
        <SectionLabel label="Identity" />
        <CredCard>
          <FieldRow label="Name" value={`${item.firstName} ${item.lastName}`} />
          {item.email && <FieldRow label="Email" value={item.email} />}
          {item.phone && <FieldRow label="Phone" value={item.phone} />}
          {item.address && <FieldRow label="Address" value={item.address} />}
          {item.city && <FieldRow label="City" value={item.city} />}
          {item.country && <FieldRow label="Country" value={item.country} />}
        </CredCard>
        {item.notes && <NotesArea notes={item.notes} />}
      </div>
    );
  }
  if (item.type === 'totp') {
    return item.notes ? <NotesArea notes={item.notes} /> : null;
  }
  if (item.type === 'developer_credential') {
    return (
      <div>
        <SectionLabel label="Developer credential" />
        <CredCard>
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
        </CredCard>
        {item.credentialMode !== 'ssh_key' && item.baseUrl && (
          <>
            <SectionLabel label="Endpoint" />
            <CredCard>
              <FieldRow label="Base URL" value={item.baseUrl} />
            </CredCard>
          </>
        )}
        {item.notes && <NotesArea notes={item.notes} />}
      </div>
    );
  }
  if (item.type === 'crypto_wallet') {
    return (
      <div>
        <SectionLabel label="Wallet" />
        <CredCard>
          <PasswordRow password={item.mnemonic} label="Seed phrase" secureCopy />
          {item.passphrase && (
            <PasswordRow password={item.passphrase} label="Passphrase" secureCopy />
          )}
          {item.walletName && <FieldRow label="Wallet name" value={item.walletName} />}
          {item.network && <FieldRow label="Network" value={item.network} />}
          {item.derivationPath && <FieldRow label="Derivation path" value={item.derivationPath} />}
          {item.addressHint && <FieldRow label="Address hint" value={item.addressHint} />}
        </CredCard>
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
      <div className="flex flex-col h-full">
        <div className="h-14 bg-card border-b border-border shrink-0" />
        <div className="py-7 flex flex-col items-center gap-3 border-b border-muted px-4">
          <Skeleton className="w-[72px] h-[72px] rounded-[6px]" />
          <Skeleton className="h-6 w-36" />
          <Skeleton className="h-4 w-20" />
        </div>
        <div className="px-4 pt-4 space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-24 w-full rounded" />
        </div>
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
      initial={reduceMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={reduceMotion ? { duration: 0 } : { duration: 0.15 }}
      className="flex flex-col h-full"
    >
      {/* Top bar — 56px, bg-card */}
      <div
        data-testid="item-action-bar"
        className="h-14 bg-card border-b border-border shrink-0 flex items-center px-4 gap-3"
      >
        <Link
          to="/"
          aria-label="Back to vault"
          className="text-primary shrink-0 touch-manipulation flex items-center"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <span className="flex-1 text-center text-[16px] font-bold tracking-[-0.01em] text-foreground truncate">
          {item.title}
        </span>
        <div className="flex items-center gap-2 shrink-0">
          {isEditing ? (
            <span className="text-[10px] font-bold tracking-[0.1em] uppercase text-primary bg-primary/10 px-2 py-[3px] rounded-sm">
              Editing
            </span>
          ) : (
            <span className="text-[10px] font-bold tracking-[0.1em] uppercase text-muted-foreground bg-muted px-2 py-[3px] rounded-sm">
              {item.type.replace(/_/g, ' ')}
            </span>
          )}
          {!isReadOnly && !isEditing && (
            <>
              <button
                data-testid="action-bar-edit"
                aria-label="Edit item"
                onClick={enterEditMode}
                className="h-[30px] px-3 bg-primary text-white text-[12px] font-bold tracking-[0.08em] uppercase rounded touch-manipulation"
              >
                Edit
              </button>
              <Popover>
                <PopoverTrigger
                  data-testid="action-bar-more"
                  aria-label="More actions"
                  className="w-[30px] h-[30px] bg-muted rounded flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors touch-manipulation"
                >
                  <MoreHorizontal className="w-4 h-4" />
                </PopoverTrigger>
                <PopoverContent
                  align="end"
                  className="w-44 p-1"
                  container={document.getElementById('app-shell')}
                >
                  <button
                    data-testid="action-bar-delete"
                    onClick={() => setShowDeleteDialog(true)}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Move to trash
                  </button>
                </PopoverContent>
              </Popover>
            </>
          )}
        </div>
      </div>

      {isEditing ? (
        <div className="flex-1 overflow-y-auto p-4">
          <div className="rounded border border-border bg-card p-4">
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
        <div className="flex-1 overflow-y-auto flex flex-col">
          {/* Hero — centered column */}
          <div className="py-7 flex flex-col items-center gap-3 border-b border-muted px-4 shrink-0">
            <ItemAvatar item={item} size="lg" />
            <h1 className="text-[22px] font-bold tracking-[-0.02em] text-foreground text-center">
              {item.title}
            </h1>
            <div className="flex flex-wrap items-center justify-center gap-2">
              {itemUrl && (
                <a
                  href={itemUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded border border-border px-2.5 py-1 text-[12px] font-medium text-muted-foreground hover:text-foreground transition-colors"
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
                    className="inline-flex items-center gap-1.5 rounded border border-border px-2.5 py-1 text-[12px] font-medium text-muted-foreground"
                  >
                    <Folder className="w-3 h-3" />
                    {currentFolder.name}
                  </span>
                )
              ) : (
                <Popover open={folderPopoverOpen} onOpenChange={setFolderPopoverOpen}>
                  <PopoverTrigger
                    data-testid="move-folder-trigger"
                    className="inline-flex items-center gap-1.5 rounded border border-border px-2.5 py-1 text-[12px] font-medium text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Folder className="w-3 h-3" />
                    {currentFolder ? currentFolder.name : 'No folder'}
                    <ChevronDown className="w-2.5 h-2.5" />
                  </PopoverTrigger>
                  <PopoverContent
                    data-testid="folder-popover-content"
                    align="center"
                    className="w-40 p-1"
                    container={document.getElementById('app-shell')}
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

          {/* Content */}
          <div className="px-4 pb-6">
            {item.type === 'totp' && <TotpCode item={item} />}
            <ItemFields item={item} />
            {(item.customFields?.length ?? 0) > 0 && (
              <div>
                <SectionLabel label="Custom fields" />
                <CredCard>
                  {item.customFields!.map((f, i) => (
                    <FieldRow key={i} label={f.label} value={f.value} />
                  ))}
                </CredCard>
              </div>
            )}
            <ItemHistory itemId={itemId} />
          </div>
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
