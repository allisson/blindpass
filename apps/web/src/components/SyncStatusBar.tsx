import { AlertCircle, Check, RefreshCw, WifiOff } from 'lucide-react';
import { useSyncStatus } from '@/hooks/useSyncStatus';
import { vaultSync } from '@/lib/vaultSync';
import { session } from '@/lib/session';

function formatLastSynced(at: number | null): string {
  if (!at) return 'never';
  const diff = Math.floor((Date.now() - at) / 1000);
  if (diff < 10) return 'just now';
  if (diff < 60) return `${diff}s ago`;
  const mins = Math.floor(diff / 60);
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
}

export function SyncStatusBar() {
  const { status, lastSyncedAt, error } = useSyncStatus();

  function handleForceSync() {
    const s = session.get();
    if (s?.activeVaultId) void vaultSync.sync(s.activeVaultId, true);
  }

  return (
    <div
      className="px-3 py-1.5 flex items-center gap-1.5"
      data-testid="sync-status-bar"
      data-sync-status={status}
    >
      {status === 'offline' && <WifiOff className="w-3 h-3 text-amber-500 shrink-0" />}
      {status === 'syncing' && <RefreshCw className="w-3 h-3 text-primary animate-spin shrink-0" />}
      {status === 'idle' && lastSyncedAt !== null && (
        <Check className="w-3 h-3 text-green-500 shrink-0" />
      )}
      {status === 'error' && <AlertCircle className="w-3 h-3 text-destructive shrink-0" />}
      <span
        className={`text-[10px] flex-1 truncate ${
          status === 'error' ? 'text-destructive' : 'text-muted-foreground'
        }`}
        title={status === 'error' ? (error ?? undefined) : undefined}
      >
        {status === 'offline' &&
          (lastSyncedAt
            ? `Offline · last synced ${formatLastSynced(lastSyncedAt)}`
            : 'Offline · changes queued')}
        {status === 'syncing' && 'Syncing…'}
        {status === 'idle' && lastSyncedAt !== null && `Synced ${formatLastSynced(lastSyncedAt)}`}
        {status === 'error' && 'Sync failed'}
      </span>
      {status === 'error' ? (
        <button
          onClick={handleForceSync}
          className="text-[10px] font-medium text-destructive hover:text-destructive/80 transition-colors shrink-0"
          aria-label="Retry sync"
          data-testid="force-sync-btn"
        >
          Retry
        </button>
      ) : (
        status !== 'syncing' && (
          <button
            onClick={handleForceSync}
            className="p-0.5 rounded text-muted-foreground/60 hover:text-foreground transition-colors shrink-0"
            aria-label="Force sync"
            title="Force sync"
            data-testid="force-sync-btn"
          >
            <RefreshCw className="w-2.5 h-2.5" />
          </button>
        )
      )}
    </div>
  );
}
