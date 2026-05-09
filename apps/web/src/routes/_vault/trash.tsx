import { createFileRoute } from '@tanstack/react-router';
import { getItemSubtitle } from '@/components/vault/ItemCard';
import {
  AlertCircle,
  ArrowDownAZ,
  ArrowDownZA,
  Clock,
  RotateCcw,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ResponsiveDialog } from '@/components/ui/responsive-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useEmptyTrash,
  usePurgeItem,
  useRestoreItem,
  useTrashItems,
  useVaultList,
  type DecryptedTrashedItem,
} from '@/hooks/useVault';
import { EmptyState } from '@/components/EmptyState';

export const Route = createFileRoute('/_vault/trash')({
  component: TrashPage,
});

type TrashSort = 'deleted-desc' | 'deleted-asc' | 'title-asc';

const GRID_COLS =
  'sm:grid sm:grid-cols-[minmax(0,1.5fr)_minmax(8rem,0.9fr)_minmax(8rem,0.7fr)_auto] sm:gap-3 sm:items-center';

const ISO_DATE_RE = /^(\d{4}-\d{2}-\d{2})/;
const DAY_MS = 24 * 60 * 60 * 1000;

function formatDeletedAt(deletedAt: string) {
  const iso = ISO_DATE_RE.exec(deletedAt)?.[1] ?? deletedAt.slice(0, 10);
  const t = new Date(deletedAt).getTime();
  if (!Number.isFinite(t)) return { iso, relative: null as string | null };
  const days = Math.floor((Date.now() - t) / DAY_MS);
  let relative: string | null = null;
  if (days <= 0) relative = 'today';
  else if (days === 1) relative = 'yesterday';
  else if (days < 7) relative = `${days}d ago`;
  return { iso, relative };
}

function getSortIcon(sort: TrashSort) {
  if (sort === 'deleted-asc') return <Clock className="w-3.5 h-3.5" aria-hidden="true" />;
  if (sort === 'title-asc') return <ArrowDownAZ className="w-3.5 h-3.5" aria-hidden="true" />;
  return <ArrowDownZA className="w-3.5 h-3.5" aria-hidden="true" />;
}

type RowProps = {
  item: DecryptedTrashedItem;
  vaultName: string;
  vaultMissing: boolean;
  onAskRestore: (item: DecryptedTrashedItem) => void;
  onAskPurge: (item: DecryptedTrashedItem) => void;
  restorePending: boolean;
};

function TrashItemRow({
  item,
  vaultName,
  vaultMissing,
  onAskRestore,
  onAskPurge,
  restorePending,
}: RowProps) {
  const subtitle = getItemSubtitle(item);
  const { iso, relative } = formatDeletedAt(item.deletedAt);

  return (
    <div
      role="row"
      tabIndex={-1}
      data-testid={`trash-row-${item.id}`}
      data-trash-row="true"
      data-item-id={item.id}
      data-vault-id={item.vaultId}
      className={`grid gap-3 px-3 py-3 outline-none transition-colors duration-150 hover:bg-accent/40 focus-visible:bg-accent/60 focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-inset border-b border-border/60 last:border-b-0 ${GRID_COLS}`}
    >
      <div role="cell" className="min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{item.title}</p>
          <span className="text-[10px] uppercase text-muted-foreground/70 bg-muted px-1.5 py-0.5 rounded shrink-0">
            {item.type.replace('_', ' ')}
          </span>
        </div>
        <p className="text-xs text-muted-foreground truncate">{subtitle || 'No subtitle'}</p>
      </div>
      <div role="cell" className="min-w-0">
        <p className="text-[10px] font-medium uppercase text-muted-foreground/60 sm:hidden">
          Source vault
        </p>
        <p
          className={`text-xs truncate ${
            vaultMissing ? 'italic text-muted-foreground/70' : 'text-muted-foreground'
          }`}
        >
          {vaultMissing ? '(deleted vault)' : vaultName}
        </p>
      </div>
      <div role="cell" className="min-w-0">
        <p className="text-[10px] font-medium uppercase text-muted-foreground/60 sm:hidden">
          Deleted
        </p>
        <p
          className="text-xs text-muted-foreground truncate font-mono tabular-nums tracking-tight"
          title={item.deletedAt}
        >
          <span>{iso}</span>
          {relative && (
            <span className="font-sans tracking-normal text-muted-foreground/60 ml-1.5">
              · {relative}
            </span>
          )}
        </p>
      </div>
      <div role="cell" className="flex items-center gap-1 justify-end shrink-0">
        <Button
          variant="ghost"
          size="sm"
          className="h-9 px-3 sm:h-7 sm:px-2 text-xs gap-1.5 text-foreground/80 hover:text-primary hover:bg-primary/10"
          onClick={() => onAskRestore(item)}
          disabled={restorePending}
          aria-label={`Restore ${item.title}`}
          title={`Restore ${item.title}`}
        >
          <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
          {restorePending ? 'Restoring…' : 'Restore'}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-9 px-3 sm:h-7 sm:px-2 text-xs gap-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
          onClick={() => onAskPurge(item)}
          aria-label={`Delete ${item.title} permanently`}
          title={`Delete ${item.title} permanently`}
        >
          <X className="w-3.5 h-3.5" aria-hidden="true" />
          <span className="hidden md:inline">Delete permanently</span>
        </Button>
      </div>
    </div>
  );
}

export function TrashPage() {
  const { data: items, isLoading, isError } = useTrashItems();
  const vaults = useVaultList();
  const emptyTrash = useEmptyTrash();
  const restore = useRestoreItem();
  const purge = usePurgeItem();

  const [showEmptyDialog, setShowEmptyDialog] = useState(false);
  const [restoreTarget, setRestoreTarget] = useState<DecryptedTrashedItem | null>(null);
  const [purgeTarget, setPurgeTarget] = useState<DecryptedTrashedItem | null>(null);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<TrashSort>('deleted-desc');

  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const vaultMap = useMemo(() => new Map(vaults.map((v) => [v.id, v.name])), [vaults]);
  const vaultLabel = (id: string) => vaultMap.get(id);

  const visibleItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    return [...(items ?? [])]
      .filter((item) => {
        if (!query) return true;
        return [item.title, getItemSubtitle(item), vaultMap.get(item.vaultId) ?? '']
          .join(' ')
          .toLowerCase()
          .includes(query);
      })
      .sort((a, b) => {
        if (sort === 'title-asc') return a.title.localeCompare(b.title);
        const diff = new Date(a.deletedAt).getTime() - new Date(b.deletedAt).getTime();
        return sort === 'deleted-asc' ? diff : -diff;
      });
  }, [items, search, sort, vaultMap]);

  async function handleEmptyTrash() {
    await emptyTrash.mutateAsync();
    setShowEmptyDialog(false);
    toast.success('Trash emptied');
  }

  async function handleRestore() {
    const target = restoreTarget!;
    await restore.mutateAsync({ id: target.id, vaultId: target.vaultId });
    setRestoreTarget(null);
    toast.success(`"${target.title}" restored`);
  }

  async function handlePurge() {
    const target = purgeTarget!;
    await purge.mutateAsync({ id: target.id, vaultId: target.vaultId });
    setPurgeTarget(null);
    toast.success(`"${target.title}" permanently deleted`);
  }

  // `/` focuses search anywhere on the page (mirrors vault list pattern).
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (
        e.key === '/' &&
        !(e.target instanceof HTMLInputElement) &&
        !(e.target instanceof HTMLTextAreaElement) &&
        !(e.target instanceof HTMLSelectElement)
      ) {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  function focusRowAt(idx: number) {
    const rows = listRef.current!.querySelectorAll<HTMLDivElement>('[data-trash-row="true"]');
    const clamped = Math.max(0, Math.min(idx, rows.length - 1));
    rows[clamped]?.focus();
  }

  function handleListKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    const row = (e.target as HTMLElement).closest<HTMLElement>('[data-trash-row="true"]');
    // Allow nav keys to work even when focus is inside an action button on the row.
    if (!row) return;

    const rows = Array.from(
      listRef.current!.querySelectorAll<HTMLDivElement>('[data-trash-row="true"]'),
    );
    const idx = rows.indexOf(row as HTMLDivElement);

    if (e.key === 'ArrowDown' || e.key === 'j') {
      e.preventDefault();
      focusRowAt(idx + 1);
      return;
    }
    if (e.key === 'ArrowUp' || e.key === 'k') {
      e.preventDefault();
      if (idx === 0) {
        searchRef.current?.focus();
        searchRef.current?.select();
      } else {
        focusRowAt(idx - 1);
      }
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      searchRef.current?.focus();
      return;
    }
    // Action keys only fire on the row itself, not when focus is inside a button child.
    if (e.target !== row) return;
    const id = row.dataset.itemId;
    const item = visibleItems.find((it) => it.id === id)!;
    if (e.key === 'r' || e.key === 'R' || e.key === 'Enter') {
      e.preventDefault();
      setRestoreTarget(item);
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      setPurgeTarget(item);
    }
  }

  // When the search input is focused and the user presses ↓, jump to the first row.
  function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      focusRowAt(0);
    }
  }

  const itemCount = items?.length ?? 0;
  const hasItems = itemCount > 0;

  return (
    <div className="h-full overflow-y-auto px-4 py-6 lg:px-6 lg:py-8 max-w-4xl mx-auto w-full">
      <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground/70">Recovery</p>
          <div className="flex items-baseline gap-2">
            <h1 className="font-heading text-xl font-semibold text-foreground tracking-tight">
              Trash
            </h1>
            {hasItems && (
              <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
                {itemCount}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1 max-w-prose">
            Items remain here until you purge them. Nothing is ever auto-deleted.
          </p>
        </div>
        {hasItems && (
          <Button
            variant="outline"
            size="sm"
            className="self-start text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30 sm:self-auto"
            onClick={() => setShowEmptyDialog(true)}
            disabled={emptyTrash.isPending}
          >
            Empty trash
          </Button>
        )}
      </header>

      {isLoading && (
        <div
          className="rounded-lg border border-border/60 bg-card overflow-hidden"
          aria-busy="true"
          aria-label="Loading trashed items"
        >
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className={`grid gap-3 px-3 py-3 border-b border-border/60 last:border-b-0 ${GRID_COLS}`}
            >
              <div className="space-y-1.5 min-w-0">
                <Skeleton className="h-3 w-2/3 rounded" />
                <Skeleton className="h-2.5 w-1/2 rounded" />
              </div>
              <Skeleton className="h-3 w-24 rounded hidden sm:block" />
              <Skeleton className="h-3 w-20 rounded hidden sm:block" />
              <div className="flex items-center gap-1 justify-end shrink-0">
                <Skeleton className="h-9 sm:h-7 w-20 rounded-md" />
                <Skeleton className="h-9 sm:h-7 w-7 rounded-md md:w-32" />
              </div>
            </div>
          ))}
        </div>
      )}

      {isError && (
        <div
          className="flex flex-col items-center justify-center py-20 gap-3 text-center"
          role="alert"
        >
          <AlertCircle className="w-5 h-5 text-destructive/60" />
          <p className="text-sm text-muted-foreground">Failed to load trash</p>
          <p className="text-xs text-muted-foreground/70">Recovery actions are unavailable.</p>
        </div>
      )}

      {!isLoading && !isError && itemCount === 0 && (
        <EmptyState
          Icon={Trash2}
          title="Trash is empty"
          hint="Deleted vault items will appear here. They stay until you purge them."
        />
      )}

      {!isLoading && !isError && hasItems && (
        <div className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative sm:max-w-xs sm:flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              <Input
                ref={searchRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder="Search trash..."
                aria-label="Search trash"
                className="h-8 pl-8 pr-8 text-sm"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label="Clear trash search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              {getSortIcon(sort)}
              <span>Sort</span>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as TrashSort)}
                aria-label="Sort trash"
                className="h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground transition-colors outline-none hover:border-ring/40"
              >
                <option value="deleted-desc">Newest deleted</option>
                <option value="deleted-asc">Oldest deleted</option>
                <option value="title-asc">Title A-Z</option>
              </select>
            </label>
          </div>

          <div
            ref={listRef}
            role="table"
            aria-label="Trashed items"
            className="rounded-lg border border-border/60 bg-card overflow-hidden"
            data-testid="trash-table"
            onKeyDown={handleListKeyDown}
          >
            <div
              role="row"
              className={`hidden px-3 py-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60 border-b border-border/60 bg-muted/30 ${GRID_COLS}`}
            >
              <span role="columnheader">Item</span>
              <span role="columnheader">Source vault</span>
              <span role="columnheader">Deleted</span>
              <span role="columnheader" className="text-right">
                Actions
              </span>
            </div>
            {visibleItems.length === 0 ? (
              <EmptyState Icon={Search} title="No matches" size="sm" />
            ) : (
              visibleItems.map((item) => {
                const name = vaultLabel(item.vaultId);
                return (
                  <TrashItemRow
                    key={item.id}
                    item={item}
                    vaultName={name ?? ''}
                    vaultMissing={!name}
                    onAskRestore={setRestoreTarget}
                    onAskPurge={setPurgeTarget}
                    restorePending={restore.isPending && restoreTarget?.id === item.id}
                  />
                );
              })
            )}
          </div>
        </div>
      )}

      <ResponsiveDialog
        open={!!restoreTarget}
        onOpenChange={() => setRestoreTarget(null)}
        title="Restore item?"
        description={
          restoreTarget && (
            <>
              <strong>{restoreTarget.title}</strong> will be moved back to its original vault (
              {vaultLabel(restoreTarget.vaultId) ?? 'deleted vault'}).
            </>
          )
        }
        footer={
          <>
            <Button onClick={handleRestore} disabled={restore.isPending}>
              {restore.isPending ? 'Restoring…' : 'Restore'}
            </Button>
            <Button variant="outline" onClick={() => setRestoreTarget(null)}>
              Cancel
            </Button>
          </>
        }
      />

      <ResponsiveDialog
        open={!!purgeTarget}
        onOpenChange={() => setPurgeTarget(null)}
        title="Delete permanently?"
        description={
          purgeTarget && (
            <>
              <strong>{purgeTarget.title}</strong> and all its version history will be permanently
              removed. This cannot be undone.
            </>
          )
        }
        footer={
          <>
            <Button variant="destructive" onClick={handlePurge} disabled={purge.isPending}>
              {purge.isPending ? 'Deleting…' : 'Delete permanently'}
            </Button>
            <Button variant="outline" onClick={() => setPurgeTarget(null)}>
              Cancel
            </Button>
          </>
        }
      />

      <ResponsiveDialog
        open={showEmptyDialog}
        onOpenChange={setShowEmptyDialog}
        title="Empty trash?"
        description={`All ${itemCount} item${itemCount !== 1 ? 's' : ''} and their version history will be permanently deleted. This cannot be undone.`}
        footer={
          <>
            <Button
              variant="destructive"
              onClick={handleEmptyTrash}
              disabled={emptyTrash.isPending}
            >
              {emptyTrash.isPending ? 'Emptying…' : 'Empty trash'}
            </Button>
            <Button variant="outline" onClick={() => setShowEmptyDialog(false)}>
              Cancel
            </Button>
          </>
        }
      />
    </div>
  );
}
