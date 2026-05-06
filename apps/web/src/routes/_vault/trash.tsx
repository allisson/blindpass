import { createFileRoute } from '@tanstack/react-router';
import { getItemSubtitle } from '@/components/vault/ItemCard';
import { motion } from 'framer-motion';
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
import { useMemo, useState } from 'react';
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

const listItemVariants = {
  hidden: { opacity: 0, y: 6 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.18,
      ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
      delay: i * 0.03,
    },
  }),
};

function TrashItemRow({
  item,
  index,
  vaultLabel,
}: {
  item: DecryptedTrashedItem;
  index: number;
  vaultLabel: string;
}) {
  const restore = useRestoreItem();
  const purge = usePurgeItem();
  const [showPurgeDialog, setShowPurgeDialog] = useState(false);
  const [showRestoreDialog, setShowRestoreDialog] = useState(false);

  async function handleRestore() {
    await restore.mutateAsync({ id: item.id, vaultId: item.vaultId });
    setShowRestoreDialog(false);
    toast.success(`"${item.title}" restored`);
  }

  async function handlePurge() {
    await purge.mutateAsync({ id: item.id, vaultId: item.vaultId });
    setShowPurgeDialog(false);
    toast.success(`"${item.title}" permanently deleted`);
  }

  const deletedDate = new Date(item.deletedAt).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const subtitle = getItemSubtitle(item);

  return (
    <>
      <motion.div
        role="row"
        data-testid={`trash-row-${item.id}`}
        custom={index}
        initial="hidden"
        animate="visible"
        variants={listItemVariants}
        className="grid gap-3 rounded-lg border border-border bg-card px-3 py-3 transition-colors hover:bg-accent/40 sm:grid-cols-[minmax(0,1.5fr)_minmax(8rem,0.9fr)_minmax(7rem,0.7fr)_auto] sm:items-center"
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
          <p className="text-xs text-muted-foreground truncate">{vaultLabel}</p>
        </div>
        <div role="cell" className="min-w-0">
          <p className="text-[10px] font-medium uppercase text-muted-foreground/60 sm:hidden">
            Deleted
          </p>
          <p className="text-xs text-muted-foreground truncate">{deletedDate}</p>
        </div>
        <div role="cell" className="flex items-center gap-1 justify-end shrink-0">
          <Button
            variant="default"
            size="sm"
            className="h-9 px-3 sm:h-7 sm:px-2 text-xs gap-1.5"
            onClick={() => setShowRestoreDialog(true)}
            disabled={restore.isPending}
            aria-label={`Restore ${item.title}`}
            title={`Restore ${item.title}`}
          >
            <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
            {restore.isPending ? 'Restoring…' : 'Restore'}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-9 px-3 sm:h-7 sm:px-2 text-xs gap-1.5 text-muted-foreground hover:text-destructive"
            onClick={() => setShowPurgeDialog(true)}
            aria-label={`Delete ${item.title} permanently`}
            title={`Delete ${item.title} permanently`}
          >
            <X className="w-3.5 h-3.5" aria-hidden="true" />
            <span className="hidden md:inline">Delete permanently</span>
          </Button>
        </div>
      </motion.div>

      <ResponsiveDialog
        open={showRestoreDialog}
        onOpenChange={setShowRestoreDialog}
        title="Restore item?"
        description={
          <>
            <strong>{item.title}</strong> will be moved back to its original vault ({vaultLabel}).
          </>
        }
        footer={
          <>
            <Button onClick={handleRestore} disabled={restore.isPending}>
              {restore.isPending ? 'Restoring…' : 'Restore'}
            </Button>
            <Button variant="outline" onClick={() => setShowRestoreDialog(false)}>
              Cancel
            </Button>
          </>
        }
      />

      <ResponsiveDialog
        open={showPurgeDialog}
        onOpenChange={setShowPurgeDialog}
        title="Delete permanently?"
        description={
          <>
            <strong>{item.title}</strong> and all its version history will be permanently removed.
            This cannot be undone.
          </>
        }
        footer={
          <>
            <Button variant="destructive" onClick={handlePurge} disabled={purge.isPending}>
              {purge.isPending ? 'Deleting…' : 'Delete permanently'}
            </Button>
            <Button variant="outline" onClick={() => setShowPurgeDialog(false)}>
              Cancel
            </Button>
          </>
        }
      />
    </>
  );
}

function getSortIcon(sort: TrashSort) {
  if (sort === 'deleted-asc') return <Clock className="w-3.5 h-3.5" aria-hidden="true" />;
  if (sort === 'title-asc') return <ArrowDownAZ className="w-3.5 h-3.5" aria-hidden="true" />;
  return <ArrowDownZA className="w-3.5 h-3.5" aria-hidden="true" />;
}

export function TrashPage() {
  const { data: items, isLoading, isError } = useTrashItems();
  const vaults = useVaultList();
  const emptyTrash = useEmptyTrash();
  const [showEmptyDialog, setShowEmptyDialog] = useState(false);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<TrashSort>('deleted-desc');

  const vaultLabel = useMemo(() => {
    const map = new Map(vaults.map((v) => [v.id, v.name]));
    return (id: string) => map.get(id) ?? 'Vault';
  }, [vaults]);

  const visibleItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    return [...(items ?? [])]
      .filter((item) => {
        if (!query) return true;
        return [item.title, getItemSubtitle(item), vaultLabel(item.vaultId)]
          .join(' ')
          .toLowerCase()
          .includes(query);
      })
      .sort((a, b) => {
        if (sort === 'title-asc') return a.title.localeCompare(b.title);
        const diff = new Date(a.deletedAt).getTime() - new Date(b.deletedAt).getTime();
        return sort === 'deleted-asc' ? diff : -diff;
      });
  }, [items, search, sort, vaultLabel]);

  async function handleEmptyTrash() {
    await emptyTrash.mutateAsync();
    setShowEmptyDialog(false);
    toast.success('Trash emptied');
  }

  return (
    <div className="p-4 sm:p-6 h-full overflow-auto">
      <div className="flex flex-col gap-3 mb-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Trash2 className="w-5 h-5 text-muted-foreground" />
          <h1 className="text-xl font-semibold text-foreground">Trash</h1>
          {items && items.length > 0 && (
            <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
              {items.length}
            </span>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          className="self-start text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30 disabled:text-muted-foreground sm:self-auto"
          onClick={() => setShowEmptyDialog(true)}
          disabled={!items?.length || emptyTrash.isPending}
        >
          Empty trash
        </Button>
      </div>

      {isLoading && (
        <div className="space-y-1.5" aria-busy="true" aria-label="Loading trashed items">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="grid gap-3 rounded-lg border border-border bg-card px-3 py-3 sm:grid-cols-[minmax(0,1.5fr)_minmax(8rem,0.9fr)_minmax(7rem,0.7fr)_auto] sm:items-center"
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

      {!isLoading && !isError && items?.length === 0 && (
        <EmptyState
          Icon={Trash2}
          title="Trash is empty"
          hint="Deleted vault items will appear here before permanent deletion."
        />
      )}

      {!isLoading && !isError && items && items.length > 0 && (
        <div className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative sm:max-w-xs sm:flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
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
                className="h-8 rounded-lg border border-input bg-background px-2 text-xs text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <option value="deleted-desc">Newest deleted</option>
                <option value="deleted-asc">Oldest deleted</option>
                <option value="title-asc">Title A-Z</option>
              </select>
            </label>
          </div>

          <div
            role="table"
            aria-label="Trashed items"
            className="space-y-1.5"
            data-testid="trash-table"
          >
            <div
              role="row"
              className="hidden px-3 text-[10px] font-medium uppercase text-muted-foreground/60 sm:grid sm:grid-cols-[minmax(0,1.5fr)_minmax(8rem,0.9fr)_minmax(7rem,0.7fr)_auto] sm:gap-3 border border-transparent"
            >
              <span role="columnheader">Item</span>
              <span role="columnheader">Source vault</span>
              <span role="columnheader">Deleted</span>
              <span role="columnheader" className="text-right">
                Actions
              </span>
            </div>
            {visibleItems.map((item, i) => (
              <TrashItemRow
                key={item.id}
                item={item}
                index={i}
                vaultLabel={vaultLabel(item.vaultId)}
              />
            ))}
          </div>

          {visibleItems.length === 0 && <EmptyState Icon={Search} title="No matches" size="sm" />}
        </div>
      )}

      <ResponsiveDialog
        open={showEmptyDialog}
        onOpenChange={setShowEmptyDialog}
        title="Empty trash?"
        description={`All ${items?.length ?? 0} item${(items?.length ?? 0) !== 1 ? 's' : ''} and their version history will be permanently deleted. This cannot be undone.`}
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
