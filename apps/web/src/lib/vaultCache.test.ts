import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { vaultCache, type CachedVaultItem } from './vaultCache';

const item = (id: string, vaultId = 'vault-1'): CachedVaultItem => ({
  id,
  vaultId,
  encryptedData: { ciphertext: 'c', nonce: 'n' },
  encryptedItemKey: { ciphertext: 'kc', nonce: 'kn' },
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: new Date().toISOString(),
});

beforeEach(() => {
  vi.stubGlobal('indexedDB', new IDBFactory());
});

describe('vaultCache.upsertItems / getItems', () => {
  it('stores and retrieves items for a vault', async () => {
    await vaultCache.upsertItems([item('a'), item('b')]);
    const result = await vaultCache.getItems('vault-1');
    expect(result.map((i) => i.id).sort()).toEqual(['a', 'b']);
  });

  it('upsert overwrites existing item', async () => {
    const original = item('a');
    await vaultCache.upsertItems([original]);
    const updated = { ...original, updatedAt: '2030-01-01T00:00:00.000Z' };
    await vaultCache.upsertItems([updated]);
    const result = await vaultCache.getItems('vault-1');
    expect(result).toHaveLength(1);
    expect(result[0].updatedAt).toBe('2030-01-01T00:00:00.000Z');
  });

  it('getItems returns empty array when no items cached', async () => {
    const result = await vaultCache.getItems('vault-empty');
    expect(result).toEqual([]);
  });

  it('getItems filters by vaultId', async () => {
    await vaultCache.upsertItems([item('a', 'vault-1'), item('b', 'vault-2')]);
    const v1 = await vaultCache.getItems('vault-1');
    const v2 = await vaultCache.getItems('vault-2');
    expect(v1.map((i) => i.id)).toEqual(['a']);
    expect(v2.map((i) => i.id)).toEqual(['b']);
  });

  it('no-op when items array is empty', async () => {
    await expect(vaultCache.upsertItems([])).resolves.toBeUndefined();
  });
});

describe('vaultCache.deleteItems', () => {
  it('removes items by id', async () => {
    await vaultCache.upsertItems([item('a'), item('b'), item('c')]);
    await vaultCache.deleteItems(['a', 'c']);
    const result = await vaultCache.getItems('vault-1');
    expect(result.map((i) => i.id)).toEqual(['b']);
  });

  it('no-op when ids array is empty', async () => {
    await vaultCache.upsertItems([item('a')]);
    await expect(vaultCache.deleteItems([])).resolves.toBeUndefined();
    const result = await vaultCache.getItems('vault-1');
    expect(result).toHaveLength(1);
  });
});

describe('vaultCache.getSyncMeta / setSyncMeta', () => {
  it('returns null when no meta exists', async () => {
    const meta = await vaultCache.getSyncMeta();
    expect(meta).toBeNull();
  });

  it('stores and retrieves sync meta', async () => {
    await vaultCache.setSyncMeta({
      lastSyncedAt: '2025-01-01T00:00:00Z',
      syncedAt: 1000,
    });
    const meta = await vaultCache.getSyncMeta();
    expect(meta).toEqual({
      lastSyncedAt: '2025-01-01T00:00:00Z',
      syncedAt: 1000,
    });
  });

  it('setSyncMeta overwrites existing', async () => {
    await vaultCache.setSyncMeta({ lastSyncedAt: 'old', syncedAt: 0 });
    await vaultCache.setSyncMeta({ lastSyncedAt: 'new', syncedAt: 1 });
    const meta = await vaultCache.getSyncMeta();
    expect(meta?.lastSyncedAt).toBe('new');
  });
});

describe('vaultCache.clearVault', () => {
  it('removes items for a vault without touching sync meta', async () => {
    await vaultCache.upsertItems([item('a'), item('b', 'vault-2')]);
    await vaultCache.setSyncMeta({ lastSyncedAt: 'ts', syncedAt: 0 });
    await vaultCache.clearVault('vault-1');
    expect(await vaultCache.getItems('vault-1')).toEqual([]);
    // sync meta preserved — clearing one vault does not reset the user-level cursor
    expect(await vaultCache.getSyncMeta()).not.toBeNull();
    // vault-2 untouched
    expect(await vaultCache.getItems('vault-2')).toHaveLength(1);
  });
});

describe('vaultCache.clearAll', () => {
  it('wipes all items and sync meta', async () => {
    await vaultCache.upsertItems([item('a', 'vault-1'), item('b', 'vault-2')]);
    await vaultCache.setSyncMeta({ lastSyncedAt: 'ts', syncedAt: 0 });
    await vaultCache.clearAll();
    expect(await vaultCache.getItems('vault-1')).toEqual([]);
    expect(await vaultCache.getItems('vault-2')).toEqual([]);
    expect(await vaultCache.getSyncMeta()).toBeNull();
  });
});
