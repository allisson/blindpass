import type { QueryClient } from '@tanstack/react-query';
import { api } from './api';
import { vaultCache, type CachedVaultItem } from './vaultCache';
import { session } from './session';
import { fetchAllPages } from './fetchAllPages';
import type { VaultItem } from '@blindpass/api-schema';

export type SyncStatus = 'idle' | 'syncing' | 'offline' | 'error';

export interface SyncState {
  status: SyncStatus;
  lastSyncedAt: number | null;
  error: string | null;
}

type Listener = (state: SyncState) => void;

let _state: SyncState = { status: 'idle', lastSyncedAt: null, error: null };
const _listeners: Set<Listener> = new Set();
let _pollInterval: ReturnType<typeof setInterval> | null = null;
let _onOnline: (() => void) | null = null;
let _qc: QueryClient | null = null;

function notify(patch: Partial<SyncState>): void {
  _state = { ..._state, ...patch };
  for (const fn of _listeners) fn(_state);
}

function toCache(item: VaultItem, vaultId: string): CachedVaultItem {
  return {
    id: item.id,
    vaultId,
    encryptedData: item.encryptedData,
    encryptedItemKey: item.encryptedItemKey,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

async function runSync(vaultId: string, force: boolean): Promise<void> {
  if (!navigator.onLine) {
    notify({ status: 'offline' });
    return;
  }

  notify({ status: 'syncing', error: null });

  try {
    const meta = force ? null : await vaultCache.getSyncMeta(vaultId);

    if (meta) {
      const delta = await api.getItemsDelta(vaultId, meta.lastSyncedAt);
      if (delta.items.length)
        await vaultCache.upsertItems(delta.items.map((i) => toCache(i, vaultId)));
      if (delta.deletedIds.length) await vaultCache.deleteItems(delta.deletedIds);
      await vaultCache.setSyncMeta({
        vaultId,
        lastSyncedAt: delta.serverTime,
        syncedAt: Date.now(),
      });
    } else {
      const items = await fetchAllPages((cursor) =>
        api.getItems(vaultId, cursor).then((r) => ({ data: r.items, nextCursor: r.nextCursor })),
      );
      if (items.length) await vaultCache.upsertItems(items.map((i) => toCache(i, vaultId)));
      await vaultCache.setSyncMeta({
        vaultId,
        lastSyncedAt: new Date(Date.now() - 60_000).toISOString(),
        syncedAt: Date.now(),
      });
    }

    notify({ status: 'idle', lastSyncedAt: Date.now(), error: null });
    _qc?.invalidateQueries({ queryKey: ['vaultItems'] });
  } catch (err) {
    notify({
      status: navigator.onLine ? 'error' : 'offline',
      error: err instanceof Error ? err.message : 'Sync failed',
    });
  }
}

export const vaultSync = {
  getState: (): SyncState => _state,

  subscribe(fn: Listener): () => void {
    _listeners.add(fn);
    return () => {
      _listeners.delete(fn);
    };
  },

  sync(vaultId: string, force = false): Promise<void> {
    if (_state.status === 'syncing') return Promise.resolve();
    return runSync(vaultId, force);
  },

  startPolling(vaultId: string, qc: QueryClient): void {
    vaultSync.stopPolling();
    _qc = qc;

    void vaultSync.sync(vaultId, false);

    _onOnline = () => void vaultSync.sync(vaultId, false);
    window.addEventListener('online', _onOnline);

    _pollInterval = setInterval(() => {
      if (session.get()?.keychain) void vaultSync.sync(vaultId, false);
    }, 5 * 60_000);
  },

  stopPolling(): void {
    if (_onOnline) {
      window.removeEventListener('online', _onOnline);
      _onOnline = null;
    }
    if (_pollInterval !== null) {
      clearInterval(_pollInterval);
      _pollInterval = null;
    }
    _qc = null;
    notify({ status: 'idle', lastSyncedAt: null, error: null });
  },
};
