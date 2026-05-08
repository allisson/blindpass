import { AlertCircle, Check, RefreshCw, WifiOff } from 'lucide-react';
import { useSyncBoundary } from '@/components/sync/SyncBoundary';

const STUCK_THRESHOLD = 2;

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
  const { phase, lastError, lastSyncedAt, consecutiveFailures, forceSync } = useSyncBoundary();
  const stuck = phase === 'error' && consecutiveFailures >= STUCK_THRESHOLD;

  return (
    <div
      className="px-3 py-1.5 flex items-center gap-1.5"
      data-testid="sync-status-bar"
      data-sync-status={phase}
      data-stuck={stuck ? 'true' : undefined}
    >
      {phase === 'offline' && <WifiOff className="w-3 h-3 text-amber-500 shrink-0" />}
      {phase === 'syncing' && <RefreshCw className="w-3 h-3 text-primary animate-spin shrink-0" />}
      {phase === 'idle' && lastSyncedAt !== null && (
        <Check className="w-3 h-3 text-green-500 shrink-0" />
      )}
      {phase === 'error' && <AlertCircle className="w-3 h-3 text-destructive shrink-0" />}
      <span
        className={`text-[10px] flex-1 truncate ${
          phase === 'error' ? 'text-destructive' : 'text-muted-foreground'
        }`}
        title={phase === 'error' ? (lastError?.message ?? undefined) : undefined}
      >
        {phase === 'offline' &&
          (lastSyncedAt
            ? `Offline · last synced ${formatLastSynced(lastSyncedAt)}`
            : 'Offline · changes queued')}
        {phase === 'syncing' && 'Syncing…'}
        {phase === 'idle' && lastSyncedAt !== null && `Synced ${formatLastSynced(lastSyncedAt)}`}
        {phase === 'error' &&
          (stuck ? `Sync stuck (${consecutiveFailures} retries)` : 'Sync failed')}
      </span>
      {phase === 'error' ? (
        <button
          onClick={() => void forceSync()}
          className="text-[10px] font-medium text-destructive hover:text-destructive/80 transition-colors shrink-0"
          aria-label="Retry sync"
          data-testid="force-sync-btn"
        >
          Retry
        </button>
      ) : (
        phase !== 'syncing' && (
          <button
            onClick={() => void forceSync()}
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
