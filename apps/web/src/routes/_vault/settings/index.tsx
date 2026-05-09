import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { SettingsListPanel } from '@/components/settings/SettingsListPanel';
import { session } from '@/lib/session';
import { loadTheme, type Theme } from '@/lib/theme';
import { useSyncBoundary, type SyncPhase } from '@/components/sync/SyncBoundary';

const SYNC_PHASE_LABEL: Record<SyncPhase, string> = {
  idle: 'up to date',
  syncing: 'syncing',
  offline: 'offline',
  error: 'error',
};

export const Route = createFileRoute('/_vault/settings/')({
  component: SettingsIndex,
});

function formatRelative(ts: number): string {
  const delta = Math.max(0, Date.now() - ts);
  const m = Math.floor(delta / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function SettingsVitals() {
  const [theme, setTheme] = useState<Theme>(() => loadTheme());
  const sync = useSyncBoundary();
  const s = session.get();
  const idle = session.getIdleMinutes();
  const vaultCount = s?.vaults.size ?? 0;

  useEffect(() => {
    function onChange(e: Event) {
      setTheme((e as CustomEvent<Theme>).detail);
    }
    window.addEventListener('bp:theme-change', onChange);
    return () => window.removeEventListener('bp:theme-change', onChange);
  }, []);

  const lastSync = sync.lastSyncedAt ? formatRelative(sync.lastSyncedAt) : 'never';

  return (
    <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2.5 max-w-md">
      <Row label="Auto-lock" value={idle === 0 ? 'disabled' : `${idle} min`} />
      <Row label="Theme" value={theme} />
      <Row label="Vaults" value={String(vaultCount)} />
      <Row
        label="Sync"
        value={`${SYNC_PHASE_LABEL[sync.phase]}${sync.pendingItemIds.size ? ` · ${sync.pendingItemIds.size} pending` : ''}`}
      />
      <Row label="Last sync" value={lastSync} />
      <Row label="Username" value={s?.username ?? '—'} />
    </dl>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-[11px] uppercase tracking-wider text-muted-foreground/70 self-baseline">
        {label}
      </dt>
      <dd className="text-sm text-foreground font-mono tabular-nums break-words">{value}</dd>
    </>
  );
}

function SettingsIndex() {
  return (
    <>
      <div className="md:hidden">
        <SettingsListPanel />
      </div>
      <div className="hidden md:flex md:h-full md:flex-col px-8 py-10 max-w-2xl">
        <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60 mb-4">
          Current state
        </p>
        <SettingsVitals />
      </div>
    </>
  );
}
