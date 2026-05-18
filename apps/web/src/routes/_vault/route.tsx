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
  Layers,
  Lock,
  LogOut,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Shield,
  Trash2,
  User,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Drawer } from 'vaul';
import { vaultColor } from '@/lib/vaultColor';
import { ItemCard } from '@/components/vault/ItemCard';
import { ItemCardSkeleton } from '@/components/vault/ItemCardSkeleton';
import { OnboardingEmpty } from '@/components/vault/OnboardingEmpty';
import { EmptyState } from '@/components/EmptyState';
import { passwordStrength } from '@/lib/passwordStrength';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  useVaultItems,
  useAllVaultItems,
  useDeleteItem,
  useMoveItem,
  useSwitchVault,
  type DecryptedGlobalVaultItem,
} from '@/hooks/useVault';
import {
  useFolders,
  useCreateFolder,
  useRenameFolder,
  useDeleteFolder,
  type DecryptedFolder,
} from '@/hooks/useFolders';
const CommandPalette = lazy(() =>
  import('@/components/CommandPalette').then((m) => ({ default: m.CommandPalette })),
);
import { VaultSheet } from '@/components/VaultSheet';
import { ShortcutsDialog } from '@/components/ShortcutsDialog';
import { applyTheme, loadTheme, type Theme } from '@/lib/theme';
import { session, clearLastUsername, getLastUsername } from '@/lib/session';
import { api } from '@/lib/api';
import { vaultCache } from '@/lib/vaultCache';
import { SyncBoundary } from '@/components/sync/SyncBoundary';
import { SyncStatusBar } from '@/components/SyncStatusBar';
import { KeychainRequired } from '@/components/keychain/KeychainRequired';
import { BottomTabBar } from '@/components/vault/shell/BottomTabBar';
import { ListPanelAnimator, MainAnimator } from '@/components/vault/shell/ListPanelAnimator';
import {
  CommandPaletteContext,
  useOpenCommandPalette,
} from '@/components/vault/shell/CommandPaletteContext';
import { toast } from 'sonner';
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

type FolderFilter = 'all' | string;

function FolderDropdownRow({
  selectedFolderId,
  folders,
  folderItemCount,
  onOpenPicker,
}: {
  selectedFolderId: FolderFilter;
  folders: DecryptedFolder[];
  folderItemCount: number;
  onOpenPicker: () => void;
}) {
  const isFiltering = selectedFolderId !== 'all';
  const label = isFiltering
    ? (folders.find((f) => f.id === selectedFolderId)?.name ?? 'Folder')
    : 'All Folders';
  return (
    <div className="h-11 border-b border-muted shrink-0 flex items-center px-3 gap-2">
      <button
        onClick={onOpenPicker}
        className="flex items-center gap-1.5 text-left px-2 py-1.5 rounded-lg hover:bg-accent transition-colors touch-manipulation -ml-2"
        aria-label="Filter by folder"
      >
        {isFiltering ? (
          <FolderOpen className="w-4 h-4 text-primary shrink-0" />
        ) : (
          <Folder className="w-4 h-4 text-muted-foreground shrink-0" />
        )}
        <span
          className={`text-sm font-semibold ${isFiltering ? 'text-primary' : 'text-foreground'}`}
        >
          {label}
        </span>
        <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
      </button>
      <span className="ml-auto text-[11px] font-bold tracking-[0.06em] text-muted-foreground bg-muted px-[7px] py-[2px] rounded-sm shrink-0">
        {folderItemCount} items
      </span>
    </div>
  );
}

function FolderPickerSheet({
  open,
  onOpenChange,
  folders,
  selectedFolderId,
  onSelect,
  items,
  isReadOnly,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folders: DecryptedFolder[];
  selectedFolderId: FolderFilter;
  onSelect: (id: FolderFilter) => void;
  items: { folderId?: string | null }[] | undefined;
  isReadOnly: boolean;
}) {
  const createFolder = useCreateFolder();
  const renameFolder = useRenameFolder();
  const deleteFolder = useDeleteFolder();
  const [creating, setCreating] = useState(false);
  const [createName, setCreateName] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const totalCount = items?.length ?? 0;
  const folderCount = (folderId: string) =>
    items?.filter((i) => i.folderId === folderId).length ?? 0;

  async function commitCreate() {
    const name = createName.trim();
    if (!name) {
      setCreating(false);
      return;
    }
    const folder = await createFolder.mutateAsync(name);
    setCreateName('');
    setCreating(false);
    onSelect(folder.id);
    onOpenChange(false);
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

  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal container={document.getElementById('app-shell')}>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-black/50" />
        <Drawer.Content
          className="fixed bottom-0 inset-x-0 z-50 flex flex-col rounded-t-2xl bg-popover border-t border-border outline-none max-h-[85dvh]"
          aria-describedby={undefined}
        >
          <div className="mx-auto mt-3 mb-1 h-1 w-10 rounded-full bg-border shrink-0" />
          <div className="flex items-center justify-between px-4 py-3 shrink-0">
            <Drawer.Title className="text-base font-semibold">Filter by folder</Drawer.Title>
            <button
              onClick={() => onOpenChange(false)}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors touch-manipulation"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="overflow-y-auto overscroll-contain flex-1 px-3 pb-2">
            <button
              onClick={() => {
                onSelect('all');
                onOpenChange(false);
              }}
              className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left hover:bg-accent transition-colors touch-manipulation mb-0.5"
            >
              <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center shrink-0">
                <Folder className="w-4 h-4 text-muted-foreground" />
              </div>
              <span className="flex-1 text-sm font-medium">All Folders</span>
              <span className="text-xs text-muted-foreground/70 mr-2" aria-hidden="true">
                {totalCount}
              </span>
              <Check
                className={`w-4 h-4 shrink-0 ${selectedFolderId === 'all' ? 'text-primary' : 'invisible'}`}
              />
            </button>

            <div className="space-y-0.5">
              {folders.map((folder) => (
                <div key={folder.id} className="flex items-center gap-1">
                  {renamingId === folder.id ? (
                    <Input
                      autoFocus
                      data-testid={`rename-folder-input-${folder.id}`}
                      className="flex-1 h-10 text-sm mx-1"
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
                      onClick={() => {
                        onSelect(folder.id);
                        onOpenChange(false);
                      }}
                      className="flex-1 flex items-center gap-3 px-3 py-3 rounded-xl text-left hover:bg-accent transition-colors touch-manipulation min-w-0"
                    >
                      <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center shrink-0">
                        <Folder className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <span className="flex-1 text-sm font-medium truncate">{folder.name}</span>
                      <span className="text-xs text-muted-foreground/70 mr-2" aria-hidden="true">
                        {folderCount(folder.id)}
                      </span>
                      <Check
                        className={`w-4 h-4 shrink-0 ${selectedFolderId === folder.id ? 'text-primary' : 'invisible'}`}
                      />
                    </button>
                  )}
                  {!isReadOnly && renamingId !== folder.id && (
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        data-testid={`folder-options-button-${folder.id}`}
                        className="w-10 h-10 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors shrink-0 touch-manipulation"
                        aria-label={`Options for ${folder.name}`}
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-32">
                        <DropdownMenuItem
                          data-testid={`rename-folder-button-${folder.id}`}
                          onClick={() => {
                            setRenamingId(folder.id);
                            setRenameValue(folder.name);
                          }}
                        >
                          <Pencil className="w-3.5 h-3.5 mr-2" />
                          Rename
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          data-testid={`delete-folder-button-${folder.id}`}
                          onClick={() => void handleDelete(folder.id)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="w-3.5 h-3.5 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              ))}
            </div>
          </div>

          {!isReadOnly && (
            <div
              className="px-3 pt-2 border-t border-border"
              style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
            >
              {creating ? (
                <div className="flex items-center gap-2 py-1">
                  <Input
                    autoFocus
                    data-testid="new-folder-input"
                    placeholder="Folder name…"
                    className="flex-1 h-10 text-sm"
                    value={createName}
                    onChange={(e) => setCreateName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void commitCreate();
                      if (e.key === 'Escape') {
                        setCreating(false);
                        setCreateName('');
                      }
                    }}
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    data-testid="create-folder-button"
                    className="h-10 w-10 shrink-0"
                    onClick={() => void commitCreate()}
                    disabled={createFolder.isPending}
                    aria-label="Confirm create folder"
                  >
                    <Check className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <button
                  data-testid="create-folder-button"
                  onClick={() => setCreating(true)}
                  className="w-full flex items-center justify-center gap-2 bg-primary text-white h-11 rounded-xl font-medium text-sm hover:bg-primary/90 transition-colors touch-manipulation mt-1 mb-1"
                >
                  <Plus className="w-4 h-4" />
                  Create folder
                </button>
              )}
            </div>
          )}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

function VaultListPanel({
  onOpenVaultSheet,
  showAllVaults,
  onLock,
  onSignOut,
  isAdmin,
  username,
}: {
  onOpenVaultSheet?: () => void;
  showAllVaults: boolean;
  onLock: () => void;
  onSignOut: () => void;
  isAdmin: boolean;
  username: string;
}) {
  const openCommandPalette = useOpenCommandPalette();
  const { data: singleItems, isLoading: singleLoading, isError: singleError } = useVaultItems();
  const { data: allItems, isLoading: allLoading, isError: allError } = useAllVaultItems();
  const { data: folders = [] } = useFolders();

  const items = showAllVaults ? allItems : singleItems;
  const isLoading = showAllVaults ? allLoading : singleLoading;
  const isError = showAllVaults ? allError : singleError;

  const [activeVaultId, setActiveVaultId] = useState(() => session.get()?.activeVaultId ?? '');
  const [activeVaultName, setActiveVaultName] = useState(() => {
    const s = session.get();
    return s ? (s.vaults.get(s.activeVaultId)?.name ?? '') : '';
  });
  useEffect(() => {
    function onSwitch() {
      const s = session.get();
      if (s) {
        setActiveVaultId(s.activeVaultId);
        setActiveVaultName(s.vaults.get(s.activeVaultId)?.name ?? '');
      }
    }
    window.addEventListener('bp:vault-switch', onSwitch);
    return () => window.removeEventListener('bp:vault-switch', onSwitch);
  }, []);

  const deleteItem = useDeleteItem();
  const moveItem = useMoveItem();
  const switchVaultFn = useSwitchVault();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedTypes, setSelectedTypes] = useState<string[]>(loadStoredTypes);
  const [selectedFolderId, setSelectedFolderId] = useState<FolderFilter>('all');
  const [folderPickerOpen, setFolderPickerOpen] = useState(false);
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [lastClickedId, setLastClickedId] = useState<string | null>(null);
  const [bulkMoveOpen, setBulkMoveOpen] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressStart = useRef<{ x: number; y: number } | null>(null);
  const s = session.get();
  const isReadOnly =
    !showAllVaults && (s ? s.vaults.get(s.activeVaultId)?.role === 'viewer' : false);

  useEffect(() => {
    function onVaultSwitch() {
      setSelectedTypes([]);
      setSelectedFolderId('all');
      setSelection(new Set());
      setLastClickedId(null);
      localStorage.removeItem(STORAGE_KEY);
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
    if (showAllVaults || selectedFolderId === 'all') return items;
    return items.filter((i) => i.folderId === selectedFolderId);
  }, [items, selectedFolderId, showAllVaults]);

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

  const activeFolder =
    !showAllVaults && selectedFolderId !== 'all' && selectedFolderId !== 'unfiled'
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
      {/* Row 1: Vault pill + overflow menu */}
      <div className="h-14 bg-card border-b border-border shrink-0 flex items-center px-4 gap-2">
        <button
          onClick={onOpenVaultSheet}
          data-testid="vault-picker-trigger"
          data-active-vault={showAllVaults ? 'all' : activeVaultName}
          className="flex-1 min-w-0 flex items-center gap-2 rounded-xl hover:bg-accent transition-colors px-2 py-1.5 -ml-2 touch-manipulation"
          aria-label={showAllVaults ? 'All vaults' : activeVaultName}
        >
          {showAllVaults ? (
            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
              <Layers className="w-4 h-4 text-muted-foreground" />
            </div>
          ) : (
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-white text-[14px] font-bold"
              style={{ backgroundColor: vaultColor(activeVaultId) }}
            >
              {activeVaultName.charAt(0).toUpperCase() || '?'}
            </div>
          )}
          <span className="text-[16px] font-bold tracking-[-0.01em] text-foreground truncate">
            {showAllVaults ? 'All vaults' : activeVaultName}
          </span>
          <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
        </button>

        <div className="flex items-center gap-1 shrink-0">
          {!isReadOnly && !showAllVaults && (
            <Link
              to="/items/new"
              search={newItemSearch}
              className="w-8 h-8 bg-primary rounded flex items-center justify-center text-white shrink-0 touch-manipulation"
              aria-label="New item"
            >
              <Plus className="w-4 h-4" />
            </Link>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger
              className="w-8 h-8 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors shrink-0 touch-manipulation"
              aria-label="More options"
            >
              <MoreHorizontal className="w-4 h-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <div className="px-2 py-1.5 text-xs text-muted-foreground truncate">{username}</div>
              <DropdownMenuSeparator />
              {isAdmin && (
                <>
                  <DropdownMenuItem>
                    <Link to="/admin" className="flex items-center gap-2 w-full">
                      <Shield className="w-3.5 h-3.5" />
                      Admin panel
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem data-testid="account-menu-lock" onClick={onLock}>
                <Lock className="w-3.5 h-3.5 mr-2" />
                Lock vault
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={onSignOut}
                className="text-destructive focus:text-destructive"
              >
                <LogOut className="w-3.5 h-3.5 mr-2" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Row 2: Search bar */}
      <div className="px-[14px] h-[50px] flex items-center border-b border-muted shrink-0">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          <Input
            ref={searchRef}
            placeholder="Search items…"
            aria-label="Search vault items"
            className="pl-8 pr-8 h-9 text-sm"
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
        <button
          onClick={openCommandPalette}
          data-testid="open-command-palette"
          className="w-8 h-8 ml-1 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors shrink-0 touch-manipulation"
          aria-label="Search and commands"
        >
          <Search className="w-4 h-4" />
        </button>
      </div>

      {/* Row 3: Folder dropdown (hidden in all-vaults mode) */}
      {!showAllVaults && (
        <FolderDropdownRow
          selectedFolderId={selectedFolderId}
          folders={folders}
          folderItemCount={folderFiltered.length}
          onOpenPicker={() => setFolderPickerOpen(true)}
        />
      )}

      {/* Row 4: Type filter chips */}
      <div className="px-[14px] h-[46px] flex items-center gap-1 border-b border-muted shrink-0">
        {TYPE_OPTIONS.map(({ value, label, Icon }) => {
          const active = selectedTypes.includes(value);
          return (
            <button
              key={value}
              onClick={() => toggleType(value)}
              title={label}
              aria-label={`Filter by ${label}`}
              aria-pressed={active}
              className={`inline-flex items-center justify-center w-9 h-8 rounded-[3px] transition-colors ${
                active
                  ? 'bg-accent text-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent/60'
              }`}
            >
              <Icon className="w-4 h-4" />
            </button>
          );
        })}
        {selectedTypes.length > 0 && (
          <button
            onClick={clearTypes}
            className="text-[11px] font-bold tracking-[0.06em] uppercase ml-1 h-8 px-2 rounded-[3px] text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {isReadOnly && (
        <div className="px-4 py-2 flex items-center gap-1.5 bg-muted/40 border-b border-muted shrink-0">
          <Users className="w-3 h-3 text-muted-foreground shrink-0" />
          <span className="text-[11px] font-medium text-muted-foreground">
            Read-only · shared vault
          </span>
        </div>
      )}

      <div
        ref={listRef}
        className="flex-1 overflow-y-auto"
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
            const gItem = showAllVaults ? (item as DecryptedGlobalVaultItem) : undefined;
            const vaultLabel = gItem
              ? {
                  color: vaultColor(gItem.vaultId),
                  name: s?.vaults.get(gItem.vaultId)?.name ?? 'Unknown vault',
                }
              : undefined;
            const needsVaultSwitch = gItem && gItem.vaultId !== activeVaultId;
            return (
              <div
                key={item.id}
                data-item-id={item.id}
                className={`relative ${
                  isSelected ? 'ring-1 ring-inset ring-primary/60 bg-primary/5' : ''
                }`}
                onClickCapture={
                  needsVaultSwitch
                    ? (e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        switchVaultFn(gItem.vaultId);
                        qc.removeQueries({ queryKey: ['items'] });
                        qc.removeQueries({ queryKey: ['folders'] });
                        window.dispatchEvent(new CustomEvent('bp:vault-switch'));
                      }
                    : undefined
                }
              >
                <ItemCard
                  item={item}
                  isWeak={weakIds.has(item.id)}
                  isReused={reusedIds.has(item.id)}
                  vaultLabel={vaultLabel}
                />
              </div>
            );
          })}
      </div>

      {selection.size > 0 && !isReadOnly && (
        <div
          data-testid="bulk-bar"
          className="absolute left-0 right-0 px-3 py-2 border-t border-border bg-popover flex items-center gap-2 shadow-lg bottom-0"
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
            <PopoverContent
              align="end"
              side="top"
              className="w-44 p-1"
              container={document.getElementById('app-shell')}
            >
              <button
                onClick={() => void bulkMoveTo(null)}
                className="w-full text-left px-2 py-1.5 rounded-md text-sm hover:bg-accent transition-colors"
              >
                No folder
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

      {!showAllVaults && (
        <FolderPickerSheet
          open={folderPickerOpen}
          onOpenChange={setFolderPickerOpen}
          folders={folders}
          selectedFolderId={selectedFolderId}
          onSelect={setSelectedFolderId}
          items={singleItems}
          isReadOnly={isReadOnly}
        />
      )}
    </div>
  );
}

function VaultLayout() {
  const isMobile = true;
  const router = useRouter();
  const qc = useQueryClient();
  const isTrash = useMatch({ from: '/_vault/trash', shouldThrow: false });
  const isSettings = useMatch({ from: '/_vault/settings', shouldThrow: false });
  const isSessions = useMatch({ from: '/_vault/settings/sessions', shouldThrow: false });
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
  const [showAllVaults, setShowAllVaults] = useState(false);
  const { data: allVaultsData } = useAllVaultItems({ enabled: vaultSheetOpen || showAllVaults });
  const allVaultsItemCount = allVaultsData?.length ?? 0;

  useEffect(() => {
    function onSwitch() {
      setShowAllVaults(false);
    }
    window.addEventListener('bp:vault-switch', onSwitch);
    return () => window.removeEventListener('bp:vault-switch', onSwitch);
  }, []);

  return (
    <CommandPaletteContext.Provider value={() => setPaletteOpen(true)}>
      <SyncBoundary>
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 min-h-0 relative overflow-hidden flex">
            <ListPanelAnimator
              show={showListPanel}
              isMobile={isMobile}
              mobileHideList={mobileHideList}
            >
              <VaultListPanel
                onOpenVaultSheet={() => setVaultSheetOpen(true)}
                showAllVaults={showAllVaults}
                onLock={handleLock}
                onSignOut={() => setShowSignOutConfirm(true)}
                isAdmin={adminStatus?.isAdmin ?? false}
                username={session.get()?.username ?? ''}
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
          <SyncStatusBar />
          <BottomTabBar showListPanel={showListPanel} inert={vaultSheetOpen} />
          <VaultSheet
            open={vaultSheetOpen}
            onOpenChange={setVaultSheetOpen}
            isAllVaults={showAllVaults}
            allVaultsItemCount={allVaultsItemCount}
            onSelectAll={() => setShowAllVaults(true)}
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
    </CommandPaletteContext.Provider>
  );
}
