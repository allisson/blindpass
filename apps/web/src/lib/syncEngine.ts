import type { QueryClient } from '@tanstack/react-query';
import type { EncryptedGlobalVaultItem } from '@blindpass/api-schema';
import { api } from './api';
import { fetchAllPages } from './fetchAllPages';
import { vaultCache, type CachedVaultItem } from './vaultCache';

export type SyncEvent =
  | { type: 'started' }
  | { type: 'succeeded'; at: number }
  | { type: 'offline' }
  | { type: 'failed'; error: Error };

export interface SyncEngine {
  runOnce(opts?: { force?: boolean }): Promise<void>;
  subscribe(fn: (e: SyncEvent) => void): () => void;
}

function toCache(item: EncryptedGlobalVaultItem): CachedVaultItem {
  return {
    id: item.id,
    vaultId: item.vaultId,
    folderId: item.folderId,
    encryptedData: item.encryptedData,
    encryptedItemKey: item.encryptedItemKey,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

export function createDefaultSyncEngine(qc: QueryClient): SyncEngine {
  const listeners = new Set<(e: SyncEvent) => void>();
  let inflight: Promise<void> | null = null;

  function emit(e: SyncEvent) {
    for (const fn of listeners) fn(e);
  }

  async function runSync(force: boolean): Promise<void> {
    if (!navigator.onLine) {
      emit({ type: 'offline' });
      return;
    }

    emit({ type: 'started' });

    try {
      const meta = force ? null : await vaultCache.getSyncMeta();

      if (meta) {
        const delta = await api.getUserItemsDelta(meta.lastSyncedAt);
        if (delta.items.length) await vaultCache.upsertItems(delta.items.map(toCache));
        if (delta.deletedIds.length) await vaultCache.deleteItems(delta.deletedIds);
        await vaultCache.setSyncMeta({
          lastSyncedAt: delta.serverTime,
          syncedAt: Date.now(),
        });
      } else {
        const items = await fetchAllPages((cursor) =>
          api.getUserItems(cursor).then((r) => ({ data: r.items, nextCursor: r.nextCursor })),
        );
        const serverIds = new Set(items.map((i) => i.id));
        const allCached = await vaultCache.getAllItems();
        const staleIds = allCached.filter((c) => !serverIds.has(c.id)).map((c) => c.id);
        if (items.length) await vaultCache.upsertItems(items.map(toCache));
        if (staleIds.length) await vaultCache.deleteItems(staleIds);
        await vaultCache.setSyncMeta({
          lastSyncedAt: new Date(Date.now() - 60_000).toISOString(),
          syncedAt: Date.now(),
        });
      }

      emit({ type: 'succeeded', at: Date.now() });
      qc.invalidateQueries({ queryKey: ['vaultItems'] });
    } catch (err) {
      if (!navigator.onLine) {
        emit({ type: 'offline' });
      } else {
        emit({
          type: 'failed',
          error: err instanceof Error ? err : new Error(String(err)),
        });
      }
    }
  }

  return {
    runOnce(opts) {
      if (inflight) return inflight;
      const p = runSync(!!opts?.force).finally(() => {
        inflight = null;
      });
      inflight = p;
      return p;
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
  };
}
