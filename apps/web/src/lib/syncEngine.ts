import type { QueryClient } from '@tanstack/react-query';
import type { EncryptedVaultItem } from '@blindpass/api-schema';
import { api } from './api';
import { fetchAllPages } from './fetchAllPages';
import { vaultCache, type CachedVaultItem } from './vaultCache';

export type SyncEvent =
  | { type: 'started'; vaultId: string }
  | { type: 'succeeded'; vaultId: string; at: number }
  | { type: 'offline'; vaultId: string }
  | { type: 'failed'; vaultId: string; error: Error };

export interface SyncEngine {
  runOnce(vaultId: string, opts?: { force?: boolean }): Promise<void>;
  subscribe(fn: (e: SyncEvent) => void): () => void;
}

function toCache(item: EncryptedVaultItem, vaultId: string): CachedVaultItem {
  return {
    id: item.id,
    vaultId,
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

  async function runSync(vaultId: string, force: boolean): Promise<void> {
    if (!navigator.onLine) {
      emit({ type: 'offline', vaultId });
      return;
    }

    emit({ type: 'started', vaultId });

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

      emit({ type: 'succeeded', vaultId, at: Date.now() });
      qc.invalidateQueries({ queryKey: ['vaultItems'] });
    } catch (err) {
      if (!navigator.onLine) {
        emit({ type: 'offline', vaultId });
      } else {
        emit({
          type: 'failed',
          vaultId,
          error: err instanceof Error ? err : new Error(String(err)),
        });
      }
    }
  }

  return {
    runOnce(vaultId, opts) {
      if (inflight) return inflight;
      const p = runSync(vaultId, !!opts?.force).finally(() => {
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
