import {
  Link,
  Outlet,
  createFileRoute,
  redirect,
  useMatch,
  useRouter,
} from '@tanstack/react-router';
import { lazy, Suspense, type Dispatch, type SetStateAction } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  Check,
  ChevronDown,
  CreditCard,
  FileText,
  Folder,
  FolderOpen,
  Key,
  KeyRound,
  LogOut,
  Pencil,
  Plus,
  Search,
  Share2,
  Shield,
  Trash2,
  User,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ItemCard } from '@/components/vault/ItemCard';
import { ItemCardSkeleton } from '@/components/vault/ItemCardSkeleton';
import { OnboardingEmpty } from '@/components/vault/OnboardingEmpty';
import { EmptyState } from '@/components/EmptyState';
import { passwordStrength } from '@/lib/passwordStrength';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import {
  useVaultItems,
  useCreateVault,
  useRenameVault,
  useSwitchVault,
  useTrashItems,
  useDeleteItem,
  useMoveItem,
} from '@/hooks/useVault';
import {
  useFolders,
  useCreateFolder,
  useRenameFolder,
  useDeleteFolder,
  type DecryptedFolder,
} from '@/hooks/useFolders';
const ShareVaultModal = lazy(() =>
  import('@/components/vault/ShareVaultModal').then((m) => ({ default: m.ShareVaultModal })),
);
const CommandPalette = lazy(() =>
  import('@/components/CommandPalette').then((m) => ({ default: m.CommandPalette })),
);
import { AccountMenu } from '@/components/AccountMenu';
import { VaultSheet } from '@/components/VaultSheet';
import { ShortcutsDialog } from '@/components/ShortcutsDialog';
import { applyTheme, loadTheme, type Theme } from '@/lib/theme';
import { session, clearLastUsername, getLastUsername } from '@/lib/session';
import { api } from '@/lib/api';
import { vaultCache } from '@/lib/vaultCache';
import { SyncBoundary } from '@/components/sync/SyncBoundary';
import { KeychainRequired } from '@/components/keychain/KeychainRequired';
import { VaultSidebar } from '@/components/vault/shell/VaultSidebar';
import { BottomTabBar } from '@/components/vault/shell/BottomTabBar';
import { ListPanelAnimator, MainAnimator } from '@/components/vault/shell/ListPanelAnimator';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useLeaveShare } from '@/hooks/useVaultSharing';
import { toast } from 'sonner';
import { useIsMobile } from '@/hooks/use-is-mobile';
import { ResponsiveDialog } from '@/components/ui/responsive-dialog';

export const Route = createFileRoute('/_vault')({
  beforeLoad: () => {
    const s = session.get();
    if (!s || !s.keychain) {
      throw redirect({ to: getLastUsername() ? '/unlock' : '/login' });
    }
  },
  component: VaultLayout,
});

const TYPE_OPTIONS = [
  { value: 'login', label: 'Login', Icon: KeyRound },
  { value: 'secure_note', label: 'Note', Icon: FileText },
  { value: 'payment_card', label: 'Card', Icon: CreditCard },
  { value: 'identity', label: 'Identity', Icon: User },
  { value: 'totp', label: 'Auth', Icon: Shield },
  { value: 'developer_credential', label: 'Developer', Icon: Key },
  { value: 'crypto_wallet', label: 'Wallet', Icon: Wallet },
];

const STORAGE_KEY = 'bp:vault:typeFilter';

function loadStoredTypes(): string[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
  } catch {
    return [];
  }
}

function VaultPicker() {
  const [open, setOpen] = useState(false);
  const [localActiveId, setLocalActiveId] = useState(() => session.get()?.activeVaultId ?? '');
  const [localVaults, setLocalVaults] = useState(() => {
    const s = session.get();
    if (!s)
      return [] as {
        id: string;
        name: string;
        isShared: boolean;
        ownerUsername?: string;
        shareId?: string;
      }[];
    return Array.from(s.vaults.entries()).map(([id, v]) => ({
      id,
      name: v.name,
      isShared: v.isShared,
      ownerUsername: v.ownerUsername,
      shareId: v.shareId,
    }));
  });
  const [shareVaultId, setShareVaultId] = useState<string | null>(null);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [creating, setCreating] = useState(false);
  const [createName, setCreateName] = useState('');
  const [leaveConfirm, setLeaveConfirm] = useState<{
    vaultId: string;
    shareId: string;
    name: string;
  } | null>(null);

  const switchVault = useSwitchVault();
  const createVault = useCreateVault();
  const renameVault = useRenameVault();
  const leaveShare = useLeaveShare();
  const router = useRouter();

  const activeVault = localVaults.find((v) => v.id === localActiveId);

  function handleSwitch(id: string) {
    switchVault(id);
    setLocalActiveId(id);
    setOpen(false);
    window.dispatchEvent(new CustomEvent('bp:vault-switch'));
  }

  function startRename(id: string, name: string) {
    setRenameId(id);
    setRenameValue(name);
  }

  async function commitRename(vaultId: string) {
    const trimmed = renameValue.trim();
    if (!trimmed) {
      setRenameId(null);
      return;
    }
    await renameVault.mutateAsync({ vaultId, name: trimmed });
    setLocalVaults((prev) => prev.map((v) => (v.id === vaultId ? { ...v, name: trimmed } : v)));
    setRenameId(null);
  }

  async function commitCreate() {
    const trimmed = createName.trim();
    if (!trimmed) {
      setCreating(false);
      return;
    }
    let vault: Awaited<ReturnType<typeof createVault.mutateAsync>>;
    try {
      vault = await createVault.mutateAsync(trimmed);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create vault');
      setCreating(false);
      return;
    }
    const s = session.get();
    if (s) {
      setLocalVaults(
        Array.from(s.vaults.entries()).map(([id, v]) => ({
          id,
          name: v.name,
          isShared: v.isShared,
          ownerUsername: v.ownerUsername,
          shareId: v.shareId,
        })),
      );
      setLocalActiveId(vault.id);
      void router.navigate({ to: '/', search: { vaultId: vault.id } });
      window.dispatchEvent(new CustomEvent('bp:vault-switch'));
    }
    setCreateName('');
    setCreating(false);
  }

  async function handleLeave() {
    if (!leaveConfirm) return;
    const { vaultId, shareId, name: vaultName } = leaveConfirm;
    setLeaveConfirm(null);
    setOpen(false);
    try {
      await leaveShare.mutateAsync({ vaultId, shareId });
      const s = session.get();
      if (s) {
        const entry = s.vaults.get(vaultId);
        if (entry) entry.vaultKey.fill(0);
        s.vaults.delete(vaultId);
        if (s.activeVaultId === vaultId) {
          const firstId = [...s.vaults.keys()][0];
          if (firstId) {
            s.activeVaultId = firstId;
            const first = s.vaults.get(firstId);
            if (s.keychain && first) s.keychain.vaultKey = first.vaultKey;
            setLocalActiveId(firstId);
          }
        }
      }
      setLocalVaults((prev) => prev.filter((v) => v.id !== vaultId));
      toast.success(`Left vault "${vaultName}"`);
    } catch {
      toast.error('Failed to leave vault');
    }
  }

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          data-testid="vault-picker-trigger"
          className="flex items-center gap-1.5 w-full px-4 py-2 text-left hover:bg-accent/40 transition-colors"
        >
          <span className="text-sm font-semibold text-foreground truncate flex-1 flex items-center gap-1.5">
            {activeVault?.name ?? 'Vault'}
            {activeVault?.isShared && (
              <span
                data-testid="active-vault-shared"
                title={
                  activeVault.ownerUsername
                    ? `Shared by ${activeVault.ownerUsername}`
                    : 'Shared with you'
                }
                className="inline-flex items-center gap-0.5 text-[10px] font-mono uppercase tracking-wider text-primary bg-primary/10 border border-primary/20 px-1.5 py-px rounded-full"
              >
                <Users className="w-2.5 h-2.5" />
                shared
              </span>
            )}
          </span>
          <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0" />
        </PopoverTrigger>
        <PopoverContent align="start" className="w-56 p-1.5">
          <div className="space-y-px">
            {localVaults.map((vault) => (
              <div key={vault.id} className="flex items-center gap-1 group/item">
                {renameId === vault.id ? (
                  <Input
                    autoFocus
                    className="flex-1 h-7 text-sm"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitRename(vault.id);
                      if (e.key === 'Escape') setRenameId(null);
                    }}
                    onBlur={() => commitRename(vault.id)}
                  />
                ) : (
                  <button
                    className="flex-1 flex items-center gap-2 px-2 py-1.5 rounded-md text-sm hover:bg-accent transition-colors text-left"
                    onClick={() => handleSwitch(vault.id)}
                  >
                    <Check
                      className={`w-3.5 h-3.5 shrink-0 ${vault.id === localActiveId ? 'text-primary' : 'invisible'}`}
                    />
                    <span className="truncate">{vault.name}</span>
                    {vault.isShared && (
                      <span
                        title={
                          vault.ownerUsername
                            ? `Shared by ${vault.ownerUsername}`
                            : 'Shared with you'
                        }
                        aria-label={
                          vault.ownerUsername
                            ? `Shared by ${vault.ownerUsername}`
                            : 'Shared with you'
                        }
                      >
                        <Users className="w-3 h-3 shrink-0 text-muted-foreground" />
                      </span>
                    )}
                  </button>
                )}
                {renameId !== vault.id && !vault.isShared && (
                  <>
                    <button
                      className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                      onClick={() => startRename(vault.id, vault.name)}
                      aria-label="Rename vault"
                      data-testid="rename-vault-button"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                    <button
                      className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                      onClick={() => setShareVaultId(vault.id)}
                      aria-label="Share vault"
                      data-testid="share-vault-button"
                    >
                      <Share2 className="w-3 h-3" />
                    </button>
                  </>
                )}
                {renameId !== vault.id && vault.isShared && vault.shareId && (
                  <button
                    className="p-1 rounded-md text-destructive/50 hover:text-destructive hover:bg-destructive/10 transition-colors"
                    onClick={() =>
                      setLeaveConfirm({
                        vaultId: vault.id,
                        shareId: vault.shareId!,
                        name: vault.name,
                      })
                    }
                    aria-label="Leave vault"
                    title="Leave vault"
                  >
                    <LogOut className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
          <Separator className="my-1.5" />
          {creating ? (
            <div className="flex items-center gap-1 px-1">
              <Input
                autoFocus
                data-testid="new-vault-name-input"
                placeholder="Vault name…"
                className="flex-1 h-7 text-sm"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitCreate();
                  if (e.key === 'Escape') {
                    setCreating(false);
                    setCreateName('');
                  }
                }}
              />
              <button
                data-testid="confirm-create-vault-button"
                className="p-1 rounded-md text-primary hover:bg-primary/10 transition-colors"
                onClick={commitCreate}
                aria-label="Create vault"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              data-testid="new-vault-button"
              className="flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              onClick={() => setCreating(true)}
            >
              <Plus className="w-3.5 h-3.5" />
              New vault
            </button>
          )}
        </PopoverContent>
      </Popover>
      {shareVaultId !== null && (
        <Suspense fallback={null}>
          <ShareVaultModal
            vaultId={shareVaultId}
            open={true}
            onOpenChange={(o) => {
              if (!o) setShareVaultId(null);
            }}
          />
        </Suspense>
      )}
      <Dialog
        open={leaveConfirm !== null}
        onOpenChange={(o) => {
          if (!o) setLeaveConfirm(null);
        }}
      >
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Leave vault</DialogTitle>
            <DialogDescription>
              Leave &ldquo;{leaveConfirm?.name}&rdquo;? You will lose access and the owner will be
              notified.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
            <Button variant="destructive" onClick={() => void handleLeave()}>
              Leave
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

type FolderFilter = 'all' | 'unfiled' | string;

const DRAG_MIME = 'application/x-blindpass-items';

function readDragIds(e: React.DragEvent): string[] {
  const raw = e.dataTransfer.getData(DRAG_MIME);
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function FolderStrip({
  folders,
  selectedFolderId,
  onSelect,
  isReadOnly,
  onDropItems,
}: {
  folders: DecryptedFolder[];
  selectedFolderId: FolderFilter;
  onSelect: (id: FolderFilter) => void;
  isReadOnly: boolean;
  onDropItems?: (folderId: string | null, ids: string[]) => void;
}) {
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  function dropProps(target: 'unfiled' | string) {
    if (isReadOnly || !onDropItems) return {};
    return {
      onDragOver: (e: React.DragEvent) => {
        if (e.dataTransfer.types.includes(DRAG_MIME)) {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          setDragOverId(target);
        }
      },
      onDragLeave: () => {
        setDragOverId((prev) => (prev === target ? null : prev));
      },
      onDrop: (e: React.DragEvent) => {
        e.preventDefault();
        const ids = readDragIds(e);
        setDragOverId(null);
        if (ids.length) {
          onDropItems(target === 'unfiled' ? null : target, ids);
        }
      },
    };
  }
  const createFolder = useCreateFolder();
  const renameFolder = useRenameFolder();
  const deleteFolder = useDeleteFolder();
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  async function commitCreate() {
    const name = newFolderName.trim();
    if (!name) {
      setCreatingFolder(false);
      setNewFolderName('');
      return;
    }
    const folder = await createFolder.mutateAsync(name);
    setCreatingFolder(false);
    setNewFolderName('');
    onSelect(folder.id);
  }

  async function commitRename(folderId: string) {
    const name = renameValue.trim();
    if (name) await renameFolder.mutateAsync({ folderId, name });
    setRenamingId(null);
  }

  async function handleDelete(folderId: string) {
    if (selectedFolderId === folderId) onSelect('all');
    await deleteFolder.mutateAsync(folderId);
  }

  const pillBase =
    'shrink-0 text-xs px-2.5 py-1.5 rounded-full border transition-colors whitespace-nowrap';
  const pillActive = 'bg-primary/15 border-primary/40 text-primary';
  const pillInactive =
    'border-border/60 text-muted-foreground hover:text-foreground hover:border-border';

  return (
    <div className="px-3 pb-2 flex gap-1 overflow-x-auto scrollbar-none" data-testid="folder-strip">
      <button
        data-testid="folder-filter-all"
        onClick={() => onSelect('all')}
        className={`${pillBase} ${selectedFolderId === 'all' ? pillActive : pillInactive}`}
      >
        All
      </button>
      <button
        data-testid="folder-filter-unfiled"
        onClick={() => onSelect('unfiled')}
        {...dropProps('unfiled')}
        className={`${pillBase} ${selectedFolderId === 'unfiled' ? pillActive : pillInactive} ${
          dragOverId === 'unfiled' ? 'ring-2 ring-primary/40 scale-105' : ''
        }`}
      >
        Unfiled
      </button>
      {folders.map((folder) => (
        <div key={folder.id} className="shrink-0 flex items-center gap-0.5 group/folder">
          {renamingId === folder.id ? (
            <input
              autoFocus
              data-testid={`rename-folder-input-${folder.id}`}
              className="text-xs px-2 py-0.5 rounded border border-primary/40 bg-background text-foreground outline-none w-24"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void commitRename(folder.id);
                if (e.key === 'Escape') setRenamingId(null);
              }}
              onBlur={() => void commitRename(folder.id)}
            />
          ) : (
            <button
              data-testid={`folder-item-${folder.id}`}
              onClick={() => onSelect(folder.id)}
              {...dropProps(folder.id)}
              className={`${pillBase} ${selectedFolderId === folder.id ? pillActive : pillInactive} ${
                dragOverId === folder.id ? 'ring-2 ring-primary/40 scale-105' : ''
              }`}
            >
              {folder.name}
            </button>
          )}
          {!isReadOnly && renamingId !== folder.id && (
            <div className="flex lg:hidden lg:group-hover/folder:flex items-center gap-0.5 ml-0.5">
              <button
                data-testid={`rename-folder-button-${folder.id}`}
                onClick={() => {
                  setRenamingId(folder.id);
                  setRenameValue(folder.name);
                }}
                className="p-0.5 rounded text-muted-foreground hover:text-foreground transition-colors"
                aria-label={`Rename ${folder.name}`}
              >
                <Pencil className="w-2.5 h-2.5" />
              </button>
              <button
                data-testid={`delete-folder-button-${folder.id}`}
                onClick={() => void handleDelete(folder.id)}
                className="p-0.5 rounded text-muted-foreground hover:text-destructive transition-colors"
                aria-label={`Delete ${folder.name}`}
              >
                <Trash2 className="w-2.5 h-2.5" />
              </button>
            </div>
          )}
        </div>
      ))}
      {!isReadOnly &&
        (creatingFolder ? (
          <div className="shrink-0 flex items-center gap-1">
            <input
              autoFocus
              data-testid="new-folder-input"
              placeholder="Folder name…"
              className="text-xs px-2 py-0.5 rounded border border-primary/40 bg-background text-foreground outline-none w-28"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void commitCreate();
                if (e.key === 'Escape') {
                  setCreatingFolder(false);
                  setNewFolderName('');
                }
              }}
              onBlur={() => void commitCreate()}
            />
          </div>
        ) : (
          <button
            data-testid="create-folder-button"
            onClick={() => setCreatingFolder(true)}
            className={`${pillBase} border-dashed ${pillInactive}`}
            aria-label="New folder"
          >
            <Plus className="w-3 h-3" />
          </button>
        ))}
    </div>
  );
}

function VaultListPanel({
  onOpenVaultSheet,
  onOpenCommandPalette,
}: {
  onOpenVaultSheet?: () => void;
  onOpenCommandPalette?: () => void;
}) {
  const { data: items, isLoading, isError } = useVaultItems();
  const { data: folders = [] } = useFolders();
  const deleteItem = useDeleteItem();
  const moveItem = useMoveItem();
  const [search, setSearch] = useState('');
  const [selectedTypes, setSelectedTypes] = useState<string[]>(loadStoredTypes);
  const [selectedFolderId, setSelectedFolderId] = useState<FolderFilter>('all');
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [lastClickedId, setLastClickedId] = useState<string | null>(null);
  const [bulkMoveOpen, setBulkMoveOpen] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressStart = useRef<{ x: number; y: number } | null>(null);
  const s = session.get();
  const isReadOnly = s ? s.vaults.get(s.activeVaultId)?.role === 'viewer' : false;
  const [activeVaultName, setActiveVaultName] = useState(() => {
    const sess = session.get();
    return sess?.vaults.get(sess.activeVaultId)?.name ?? 'Vault';
  });

  useEffect(() => {
    function onVaultSwitch() {
      setSelectedTypes([]);
      setSelectedFolderId('all');
      setSelection(new Set());
      setLastClickedId(null);
      localStorage.removeItem(STORAGE_KEY);
      const sess = session.get();
      setActiveVaultName(sess?.vaults.get(sess.activeVaultId)?.name ?? 'Vault');
    }
    window.addEventListener('bp:vault-switch', onVaultSwitch);
    return () => window.removeEventListener('bp:vault-switch', onVaultSwitch);
  }, []);

  function toggleType(type: string) {
    setSelectedTypes((prev) => {
      const next = prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }

  function clearTypes() {
    setSelectedTypes([]);
    localStorage.removeItem(STORAGE_KEY);
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (
        e.key === '/' &&
        !(e.target instanceof HTMLInputElement) &&
        !(e.target instanceof HTMLTextAreaElement)
      ) {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  const folderFiltered = useMemo(() => {
    if (!items) return [];
    if (selectedFolderId === 'all') return items;
    if (selectedFolderId === 'unfiled') return items.filter((i) => i.folderId == null);
    return items.filter((i) => i.folderId === selectedFolderId);
  }, [items, selectedFolderId]);

  const filtered = useMemo(() => {
    const result =
      selectedTypes.length > 0
        ? folderFiltered.filter((item) => selectedTypes.includes(item.type))
        : folderFiltered;
    if (!search.trim()) return result;
    const q = search.toLowerCase();
    return result.filter((item) => {
      if (item.title.toLowerCase().includes(q)) return true;
      switch (item.type) {
        case 'login':
          return (
            (item.username as string).toLowerCase().includes(q) ||
            ((item.url as string | undefined)?.toLowerCase().includes(q) ?? false)
          );
        case 'secure_note':
          return ((item.content as string) ?? '').toLowerCase().includes(q);
        case 'payment_card':
          return ((item.cardholderName as string) ?? '').toLowerCase().includes(q);
        case 'identity':
          return `${(item.firstName as string) ?? ''} ${(item.lastName as string) ?? ''}`
            .toLowerCase()
            .includes(q);
        case 'totp':
          return [item.issuer, item.accountName]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
            .includes(q);
        case 'developer_credential':
          return (
            item.credentialMode === 'token'
              ? [item.provider, item.environment, item.keyId, item.baseUrl]
              : item.credentialMode === 'client_secret_pair'
                ? [item.provider, item.environment, item.clientId, item.baseUrl]
                : [item.username, item.host, item.algorithm, item.fingerprint]
          )
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
            .includes(q);
        case 'crypto_wallet':
          return [item.walletName, item.network, item.addressHint]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
            .includes(q);
        default:
          return false;
      }
    });
  }, [folderFiltered, search, selectedTypes]);

  const { weakIds, reusedIds } = useMemo(() => {
    const weak = new Set<string>();
    const reused = new Set<string>();
    if (!items) return { weakIds: weak, reusedIds: reused };
    const seen = new Map<string, string[]>();
    for (const i of items) {
      if (i.type !== 'login') continue;
      const pwd = i.password;
      if (!pwd) continue;
      if (passwordStrength(pwd) < 2) weak.add(i.id);
      const arr = seen.get(pwd) ?? [];
      arr.push(i.id);
      seen.set(pwd, arr);
    }
    for (const ids of seen.values()) {
      if (ids.length > 1) ids.forEach((id) => reused.add(id));
    }
    return { weakIds: weak, reusedIds: reused };
  }, [items]);

  const headingLabel = useMemo(() => {
    if (selectedFolderId === 'all') return 'All Items';
    if (selectedFolderId === 'unfiled') return 'Unfiled';
    return folders.find((f) => f.id === selectedFolderId)?.name ?? 'Folder';
  }, [selectedFolderId, folders]);

  const activeFolder =
    selectedFolderId !== 'all' && selectedFolderId !== 'unfiled'
      ? folders.find((f) => f.id === selectedFolderId)
      : undefined;

  const newItemSearch = activeFolder ? { folderId: activeFolder.id } : {};

  function onListClickCapture(e: React.MouseEvent) {
    if (!(e.metaKey || e.ctrlKey || e.shiftKey)) return;
    const target = e.target as HTMLElement;
    const wrap = target.closest<HTMLElement>('[data-item-id]');
    if (!wrap) return;
    const id = wrap.dataset.itemId;
    if (!id) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.shiftKey && lastClickedId) {
      const ids = filtered.map((i) => i.id);
      const a = ids.indexOf(lastClickedId);
      const b = ids.indexOf(id);
      if (a >= 0 && b >= 0) {
        const [lo, hi] = a < b ? [a, b] : [b, a];
        setSelection((prev) => {
          const next = new Set(prev);
          for (let i = lo; i <= hi; i++) next.add(ids[i]);
          return next;
        });
      }
    } else {
      setSelection((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    }
    setLastClickedId(id);
  }

  function clearSelection() {
    setSelection(new Set());
    setLastClickedId(null);
  }

  function onListPointerDown(e: React.PointerEvent) {
    if (e.pointerType === 'mouse' || isReadOnly) return;
    const wrap = (e.target as HTMLElement).closest<HTMLElement>('[data-item-id]');
    if (!wrap) return;
    const id = wrap.dataset.itemId;
    if (!id) return;
    longPressStart.current = { x: e.clientX, y: e.clientY };

    longPressTimer.current = setTimeout(() => {
      longPressStart.current = null;
      setSelection((prev) => {
        const next = new Set(prev);
        next.add(id);
        return next;
      });
      setLastClickedId(id);
      if (navigator.vibrate) navigator.vibrate(10);
    }, 500);

    function onMove(ev: PointerEvent) {
      if (!longPressStart.current) return;
      const dx = ev.clientX - longPressStart.current.x;
      const dy = ev.clientY - longPressStart.current.y;
      if (Math.hypot(dx, dy) > 8) cancelLongPress();
    }

    function cancelLongPress() {
      if (longPressTimer.current) clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
      longPressStart.current = null;
      document.removeEventListener('pointerup', cancelLongPress);
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointercancel', cancelLongPress);
    }

    document.addEventListener('pointerup', cancelLongPress, { once: true });
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointercancel', cancelLongPress, { once: true });
  }

  async function bulkMoveTo(folderId: string | null) {
    const ids = [...selection];
    setBulkMoveOpen(false);
    try {
      await Promise.all(ids.map((id) => moveItem.mutateAsync({ id, folderId })));
      toast.success(`Moved ${ids.length} item${ids.length === 1 ? '' : 's'}`);
      clearSelection();
    } catch {
      toast.error('Failed to move some items');
    }
  }

  async function handleFolderDrop(folderId: string | null, ids: string[]) {
    try {
      await Promise.all(ids.map((id) => moveItem.mutateAsync({ id, folderId })));
      toast.success(`Moved ${ids.length} item${ids.length === 1 ? '' : 's'}`);
      if (ids.length > 1) clearSelection();
    } catch {
      toast.error('Failed to move some items');
    }
  }

  async function bulkDelete() {
    const ids = [...selection];
    setBulkDeleteOpen(false);
    try {
      await Promise.all(ids.map((id) => deleteItem.mutateAsync(id)));
      toast.success(`Moved ${ids.length} item${ids.length === 1 ? '' : 's'} to trash`);
      clearSelection();
    } catch {
      toast.error('Failed to delete some items');
    }
  }

  function onPanelKeyDown(e: React.KeyboardEvent) {
    if (
      (e.metaKey || e.ctrlKey) &&
      (e.key === 'a' || e.key === 'A') &&
      !(e.target instanceof HTMLInputElement) &&
      !(e.target instanceof HTMLTextAreaElement) &&
      !isReadOnly
    ) {
      e.preventDefault();
      setSelection(new Set(filtered.map((i) => i.id)));
    } else if (e.key === 'Escape' && selection.size > 0) {
      e.preventDefault();
      clearSelection();
    }
  }

  return (
    <div
      className="flex flex-col relative flex-1 min-h-0"
      data-testid="vault-list"
      onKeyDown={onPanelKeyDown}
    >
      {onOpenVaultSheet && (
        <div className="md:hidden px-3 pt-1 flex items-center justify-between">
          <button
            onClick={onOpenVaultSheet}
            className="flex items-center gap-1 min-h-11 px-0 text-foreground hover:text-primary transition-colors"
            aria-label="Switch vault"
          >
            <span className="text-xs font-semibold truncate">{activeVaultName}</span>
            <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0" />
          </button>
          {onOpenCommandPalette && (
            <button
              onClick={onOpenCommandPalette}
              aria-label="Search"
              className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/40 transition-colors"
            >
              <Search className="w-4 h-4" />
            </button>
          )}
        </div>
      )}
      <div className="px-3 pt-3 pb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {selectedFolderId !== 'all' ? (
            <FolderOpen className="w-3.5 h-3.5 text-primary shrink-0" />
          ) : (
            <Folder className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          )}
          <span
            data-testid="vault-list-heading"
            className="font-heading text-[13px] font-semibold text-foreground truncate tracking-tight"
          >
            {headingLabel}
          </span>
          {items && items.length > 0 && (
            <span className="text-[10px] font-mono font-medium text-muted-foreground bg-muted px-1.5 py-px rounded-full shrink-0">
              {selectedTypes.length > 0 || search.trim() ? filtered.length : folderFiltered.length}
            </span>
          )}
        </div>
        {!isReadOnly && (
          <Link
            to="/items/new"
            search={newItemSearch}
            className={buttonVariants({ size: 'icon', variant: 'ghost' }) + ' w-9 h-9 shrink-0'}
            aria-label="New item"
          >
            <Plus className="w-4 h-4" />
          </Link>
        )}
      </div>
      <FolderStrip
        folders={folders}
        selectedFolderId={selectedFolderId}
        onSelect={setSelectedFolderId}
        isReadOnly={isReadOnly}
        onDropItems={(folderId, ids) => void handleFolderDrop(folderId, ids)}
      />
      <div className="px-3 pb-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          <Input
            ref={searchRef}
            placeholder="Search…"
            aria-label="Search vault items"
            className="pl-8 pr-14 h-9 text-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                const links = listRef.current?.querySelectorAll<HTMLAnchorElement>('a');
                if (links?.length) links[0].focus();
              }
            }}
          />
          {!search && (
            <kbd className="hidden md:flex absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-[10px] font-mono text-muted-foreground/50 border border-border/50 rounded px-1 leading-4">
              /
            </kbd>
          )}
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1 mt-2">
          {TYPE_OPTIONS.map(({ value, label, Icon }) => {
            const active = selectedTypes.includes(value);
            return (
              <button
                key={value}
                onClick={() => toggleType(value)}
                title={label}
                aria-label={`Filter by ${label}`}
                aria-pressed={active}
                className={`inline-flex items-center justify-center w-7 h-7 rounded-full border transition-colors ${
                  active
                    ? 'bg-primary/15 border-primary/40 text-primary'
                    : 'border-border/60 text-muted-foreground hover:text-foreground hover:border-border'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
              </button>
            );
          })}
          {selectedTypes.length > 0 && (
            <button
              onClick={clearTypes}
              className="text-[11px] font-medium px-2 h-7 rounded-full text-muted-foreground/70 hover:text-foreground transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      </div>
      {isReadOnly && (
        <div className="mx-3 mb-2 px-2.5 py-1.5 rounded-md bg-muted/60 border border-border/40 flex items-center gap-1.5">
          <Users className="w-3 h-3 text-muted-foreground shrink-0" />
          <span className="text-[11px] text-muted-foreground">Read-only · shared vault</span>
        </div>
      )}
      <Separator />
      <div
        ref={listRef}
        className="flex-1 overflow-y-auto py-1 px-1 pb-[calc(3.5rem+env(safe-area-inset-bottom))] md:pb-1"
        onClickCapture={onListClickCapture}
        onPointerDown={onListPointerDown}
        onKeyDown={(e) => {
          const link = (e.target as HTMLElement).closest('a');
          if (!link) return;
          const links = Array.from(listRef.current!.querySelectorAll<HTMLAnchorElement>('a'));
          const idx = links.indexOf(link as HTMLAnchorElement);
          const next = e.key === 'ArrowDown' || e.key === 'j';
          const prev = e.key === 'ArrowUp' || e.key === 'k';
          if (next) {
            e.preventDefault();
            links[Math.min(idx + 1, links.length - 1)]?.focus();
          } else if (prev) {
            e.preventDefault();
            if (idx === 0) searchRef.current?.focus();
            else links[Math.max(idx - 1, 0)]?.focus();
          }
        }}
      >
        {isLoading && (
          <div className="space-y-0.5 pt-1" aria-busy="true" aria-label="Loading items">
            {Array.from({ length: 6 }).map((_, i) => (
              <ItemCardSkeleton key={i} />
            ))}
          </div>
        )}
        {isError && (
          <div className="flex flex-col items-center justify-center py-12 px-5 text-center gap-2">
            <AlertCircle className="w-5 h-5 text-destructive/60" />
            <p className="text-xs text-muted-foreground">Failed to load items</p>
          </div>
        )}
        {!isLoading && !isError && items?.length === 0 && !isReadOnly && <OnboardingEmpty />}
        {!isLoading && !isError && items?.length === 0 && isReadOnly && (
          <EmptyState
            Icon={KeyRound}
            title="No items yet"
            hint="The owner hasn't added anything to this shared vault."
            size="sm"
          />
        )}
        {!isLoading && !isError && filtered.length === 0 && (items?.length ?? 0) > 0 && (
          <EmptyState
            Icon={Search}
            title="No matches"
            hint="Try a different search or clear filters."
            size="sm"
          />
        )}
        {!isLoading &&
          !isError &&
          filtered.map((item) => {
            const isSelected = selection.has(item.id);
            return (
              <div
                key={item.id}
                data-item-id={item.id}
                draggable={!isReadOnly}
                onDragStart={(e) => {
                  if (isReadOnly) return;
                  const ids = isSelected && selection.size > 1 ? [...selection] : [item.id];
                  e.dataTransfer.setData(DRAG_MIME, JSON.stringify(ids));
                  e.dataTransfer.effectAllowed = 'move';
                }}
                className={`relative rounded-lg ${
                  isSelected ? 'ring-1 ring-primary/60 bg-primary/5' : ''
                } ${!isReadOnly ? 'cursor-grab active:cursor-grabbing' : ''}`}
              >
                <ItemCard
                  item={item}
                  isWeak={weakIds.has(item.id)}
                  isReused={reusedIds.has(item.id)}
                />
              </div>
            );
          })}
      </div>
      {selection.size > 0 && !isReadOnly && (
        <div
          data-testid="bulk-bar"
          className="absolute left-0 right-0 px-3 py-2 border-t border-border bg-popover/95 backdrop-blur-sm flex items-center gap-2 shadow-lg bottom-[calc(3.5rem+env(safe-area-inset-bottom))] md:bottom-0"
        >
          <span className="text-xs font-medium text-foreground tabular-nums">{selection.size}</span>
          <span className="text-xs text-muted-foreground">selected</span>
          <Popover open={bulkMoveOpen} onOpenChange={setBulkMoveOpen}>
            <PopoverTrigger
              data-testid="bulk-move"
              className={
                buttonVariants({ size: 'xs', variant: 'outline' }) + ' ml-auto h-7 text-xs'
              }
            >
              Move
            </PopoverTrigger>
            <PopoverContent align="end" side="top" className="w-44 p-1">
              <button
                onClick={() => void bulkMoveTo(null)}
                className="w-full text-left px-2 py-1.5 rounded-md text-sm hover:bg-accent transition-colors"
              >
                Unfiled
              </button>
              {folders.map((f) => (
                <button
                  key={f.id}
                  onClick={() => void bulkMoveTo(f.id)}
                  className="w-full text-left px-2 py-1.5 rounded-md text-sm hover:bg-accent transition-colors truncate"
                >
                  {f.name}
                </button>
              ))}
            </PopoverContent>
          </Popover>
          <Button
            size="xs"
            variant="destructive"
            data-testid="bulk-delete"
            className="h-7 text-xs"
            onClick={() => setBulkDeleteOpen(true)}
          >
            Delete
          </Button>
          <Button
            size="xs"
            variant="ghost"
            className="h-7 text-xs"
            data-testid="bulk-clear"
            onClick={clearSelection}
          >
            Clear
          </Button>
        </div>
      )}
      <ResponsiveDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        title={`Delete ${selection.size} items?`}
        description="They will be moved to Trash. You can restore them within 30 days."
        footer={
          <>
            <Button variant="destructive" onClick={() => void bulkDelete()}>
              Delete
            </Button>
            <Button variant="outline" onClick={() => setBulkDeleteOpen(false)}>
              Cancel
            </Button>
          </>
        }
      />
    </div>
  );
}

function VaultLayout() {
  const isMobile = useIsMobile();
  const router = useRouter();
  const qc = useQueryClient();
  const isTrash = useMatch({ from: '/_vault/trash', shouldThrow: false });
  const isSettings = useMatch({ from: '/_vault/settings', shouldThrow: false });
  const isSessions = useMatch({ from: '/_vault/sessions', shouldThrow: false });
  const isHealth = useMatch({ from: '/_vault/health', shouldThrow: false });
  const isAdmin = useMatch({ from: '/_vault/admin', shouldThrow: false });
  const isItemDetail = useMatch({ from: '/_vault/$itemId', shouldThrow: false });
  const isNewItem = useMatch({ from: '/_vault/items/new', shouldThrow: false });
  const isEditItem = useMatch({ from: '/_vault/$itemId_/edit', shouldThrow: false });
  const showListPanel = !isTrash && !isSettings && !isSessions && !isHealth && !isAdmin;
  const mobileHideList = !!(isItemDetail || isNewItem || isEditItem);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const [vaultSheetOpen, setVaultSheetOpen] = useState(false);
  const [theme, setTheme] = useState<Theme>(() => loadTheme());
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const { data: adminStatus } = useQuery({
    queryKey: ['adminStatus'],
    queryFn: () => api.getAdminStatus(),
    staleTime: Infinity,
  });

  function handleThemeChange(t: Theme) {
    applyTheme(t);
    setTheme(t);
  }

  useEffect(() => {
    function onThemeChange(e: Event) {
      setTheme((e as CustomEvent<Theme>).detail);
    }
    window.addEventListener('bp:theme-change', onThemeChange);
    return () => window.removeEventListener('bp:theme-change', onThemeChange);
  }, []);

  function handleLock() {
    session.clearIdleTimer();
    session.lock();
    qc.clear();
    router.navigate({ to: '/unlock' });
  }

  useEffect(() => {
    function onExpiry() {
      session.lock();
      qc.clear();
      void router.navigate({ to: '/unlock' });
    }

    let lastReset = 0;
    function handleActivity() {
      const now = Date.now();
      if (now - lastReset > 1_000) {
        lastReset = now;
        session.resetIdleTimer();
      }
    }

    session.startIdleTimer(onExpiry, session.getIdleMinutes());

    document.addEventListener('mousemove', handleActivity);
    document.addEventListener('keydown', handleActivity);
    document.addEventListener('click', handleActivity);
    document.addEventListener('touchstart', handleActivity, { passive: true });

    function onPaletteShortcut(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      } else if (
        e.key === '?' &&
        !(e.target instanceof HTMLInputElement) &&
        !(e.target instanceof HTMLTextAreaElement) &&
        !document.querySelector('[role="dialog"]')
      ) {
        e.preventDefault();
        setShortcutsOpen((v) => !v);
      }
    }
    document.addEventListener('keydown', onPaletteShortcut);

    return () => {
      session.clearIdleTimer();
      document.removeEventListener('mousemove', handleActivity);
      document.removeEventListener('keydown', handleActivity);
      document.removeEventListener('click', handleActivity);
      document.removeEventListener('touchstart', handleActivity);
      document.removeEventListener('keydown', onPaletteShortcut);
    };
  }, [qc, router]);

  function handleLogout() {
    void api.logout().catch(() => {});
    session.clear();
    clearLastUsername();
    qc.clear();
    void vaultCache.clearAll();
    localStorage.removeItem(STORAGE_KEY);
    router.navigate({ to: '/login' });
  }

  return (
    <KeychainRequired>
      <VaultLayoutContent
        adminStatus={adminStatus}
        handleLock={handleLock}
        handleLogout={handleLogout}
        handleThemeChange={handleThemeChange}
        isMobile={isMobile}
        mobileHideList={mobileHideList}
        paletteOpen={paletteOpen}
        setPaletteOpen={setPaletteOpen}
        setShortcutsOpen={setShortcutsOpen}
        setShowSignOutConfirm={setShowSignOutConfirm}
        setVaultSheetOpen={setVaultSheetOpen}
        shortcutsOpen={shortcutsOpen}
        showListPanel={showListPanel}
        showSignOutConfirm={showSignOutConfirm}
        theme={theme}
        vaultSheetOpen={vaultSheetOpen}
      />
    </KeychainRequired>
  );
}

interface VaultLayoutContentProps {
  adminStatus: { isAdmin: boolean } | undefined;
  handleLock: () => void;
  handleLogout: () => void;
  handleThemeChange: (theme: Theme) => void;
  isMobile: boolean;
  mobileHideList: boolean;
  paletteOpen: boolean;
  setPaletteOpen: Dispatch<SetStateAction<boolean>>;
  setShortcutsOpen: Dispatch<SetStateAction<boolean>>;
  setShowSignOutConfirm: Dispatch<SetStateAction<boolean>>;
  setVaultSheetOpen: Dispatch<SetStateAction<boolean>>;
  shortcutsOpen: boolean;
  showListPanel: boolean;
  showSignOutConfirm: boolean;
  theme: Theme;
  vaultSheetOpen: boolean;
}

function VaultLayoutContent({
  adminStatus,
  handleLock,
  handleLogout,
  handleThemeChange,
  isMobile,
  mobileHideList,
  paletteOpen,
  setPaletteOpen,
  setShortcutsOpen,
  setShowSignOutConfirm,
  setVaultSheetOpen,
  shortcutsOpen,
  showListPanel,
  showSignOutConfirm,
  theme,
  vaultSheetOpen,
}: VaultLayoutContentProps) {
  const { data: trashItems } = useTrashItems();
  const trashCount = trashItems?.length ?? 0;

  return (
    <>
      <SyncBoundary>
        <div
          className="h-dvh bg-background flex relative overflow-hidden"
          style={{ backgroundImage: 'var(--glow-bg)' }}
        >
          <VaultSidebar
            trashCount={trashCount}
            vaultPicker={<VaultPicker />}
            accountMenu={
              session.get()?.username ? (
                <AccountMenu
                  username={session.get()!.username!}
                  theme={theme}
                  onThemeChange={handleThemeChange}
                  onLock={handleLock}
                  onSignOutRequested={() => setShowSignOutConfirm(true)}
                  isAdmin={adminStatus?.isAdmin ?? false}
                />
              ) : null
            }
            onOpenCommandPalette={() => setPaletteOpen(true)}
            onOpenVaultSheet={() => setVaultSheetOpen(true)}
          />
          <div className="flex-1 relative overflow-hidden flex">
            <ListPanelAnimator
              show={showListPanel}
              isMobile={isMobile}
              mobileHideList={mobileHideList}
            >
              <VaultListPanel
                onOpenVaultSheet={() => setVaultSheetOpen(true)}
                onOpenCommandPalette={() => setPaletteOpen(true)}
              />
            </ListPanelAnimator>
            <MainAnimator
              isMobile={isMobile}
              showListPanel={showListPanel}
              mobileHideList={mobileHideList}
            >
              <Outlet />
            </MainAnimator>
          </div>
          <BottomTabBar
            showListPanel={showListPanel}
            trashCount={trashCount}
            inert={vaultSheetOpen}
          />
          <VaultSheet
            open={vaultSheetOpen}
            onOpenChange={setVaultSheetOpen}
            onLock={handleLock}
            onSignOut={() => setShowSignOutConfirm(true)}
            username={session.get()?.username ?? ''}
            theme={theme}
            onThemeChange={handleThemeChange}
            isAdmin={adminStatus?.isAdmin ?? false}
          />
          <Suspense fallback={null}>
            <CommandPalette
              open={paletteOpen}
              onOpenChange={setPaletteOpen}
              onLockRequested={handleLock}
              onSignOutRequested={() => setShowSignOutConfirm(true)}
              onToggleTheme={() =>
                handleThemeChange(
                  theme === 'dark' ? 'light' : theme === 'light' ? 'system' : 'dark',
                )
              }
              isDark={document.documentElement.classList.contains('dark')}
            />
          </Suspense>
          <ShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
          <ResponsiveDialog
            open={showSignOutConfirm}
            onOpenChange={setShowSignOutConfirm}
            title="Sign out?"
            description="Your vault will be locked. You will need to sign in again to access it."
            footer={
              <>
                <Button variant="destructive" onClick={handleLogout}>
                  Sign out
                </Button>
                <Button variant="outline" onClick={() => setShowSignOutConfirm(false)}>
                  Cancel
                </Button>
              </>
            }
          />
        </div>
      </SyncBoundary>
    </>
  );
}
