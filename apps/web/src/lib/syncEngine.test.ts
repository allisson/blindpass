import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';

vi.mock('./api', () => ({
  api: {
    getUserItems: vi.fn(),
    getUserItemsDelta: vi.fn(),
  },
}));

vi.mock('./vaultCache', () => ({
  vaultCache: {
    getSyncMeta: vi.fn(),
    setSyncMeta: vi.fn().mockResolvedValue(undefined),
    upsertItems: vi.fn().mockResolvedValue(undefined),
    deleteItems: vi.fn().mockResolvedValue(undefined),
    getAllItems: vi.fn().mockResolvedValue([]),
  },
}));

import { api } from './api';
import { vaultCache } from './vaultCache';
import { createDefaultSyncEngine, type SyncEvent } from './syncEngine';

function makeEngine() {
  const qc = new QueryClient();
  const engine = createDefaultSyncEngine(qc);
  const events: SyncEvent[] = [];
  engine.subscribe((e) => events.push(e));
  return { engine, events, qc };
}

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('syncEngine', () => {
  it('emits offline when navigator is offline', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    const { engine, events } = makeEngine();
    await engine.runOnce();
    expect(events.map((e) => e.type)).toEqual(['offline']);
  });

  it('full sync: emits started → succeeded; calls getUserItems + upsertItems + setSyncMeta', async () => {
    vi.mocked(vaultCache.getSyncMeta).mockResolvedValue(null);
    vi.mocked(api.getUserItems).mockResolvedValue({
      items: [
        {
          id: 'a',
          vaultId: 'v1',
          encryptedData: { ciphertext: 'c', nonce: 'n' },
          encryptedItemKey: { ciphertext: 'c', nonce: 'n' },
          createdAt: '2025-01-01T00:00:00Z',
          updatedAt: '2025-01-01T00:00:00Z',
        },
      ],
      nextCursor: null,
    } as never);

    const { engine, events } = makeEngine();
    await engine.runOnce();

    expect(events.map((e) => e.type)).toEqual(['started', 'succeeded']);
    expect(vaultCache.upsertItems).toHaveBeenCalledOnce();
    expect(vaultCache.setSyncMeta).toHaveBeenCalledOnce();
  });

  it('delta sync: passes cursor and applies deletes', async () => {
    vi.mocked(vaultCache.getSyncMeta).mockResolvedValue({
      lastSyncedAt: '2025-01-01T00:00:00Z',
      syncedAt: 1,
    });
    vi.mocked(api.getUserItemsDelta).mockResolvedValue({
      items: [],
      deletedIds: ['x'],
      serverTime: '2025-02-01T00:00:00Z',
    } as never);

    const { engine, events } = makeEngine();
    await engine.runOnce();

    expect(api.getUserItemsDelta).toHaveBeenCalledWith('2025-01-01T00:00:00Z');
    expect(vaultCache.deleteItems).toHaveBeenCalledWith(['x']);
    expect(events.map((e) => e.type)).toEqual(['started', 'succeeded']);
  });

  it('delta sync: upserts updated items when delta has items', async () => {
    vi.mocked(vaultCache.getSyncMeta).mockResolvedValue({
      lastSyncedAt: '2025-01-01T00:00:00Z',
      syncedAt: 1,
    });
    vi.mocked(api.getUserItemsDelta).mockResolvedValue({
      items: [
        {
          id: 'item-1',
          vaultId: 'v1',
          encryptedData: { ciphertext: 'c', nonce: 'n' },
          encryptedItemKey: { ciphertext: 'c', nonce: 'n' },
          createdAt: '2025-01-15T00:00:00Z',
          updatedAt: '2025-01-15T00:00:00Z',
        },
      ],
      deletedIds: [],
      serverTime: '2025-02-01T00:00:00Z',
    } as never);

    const { engine } = makeEngine();
    await engine.runOnce();

    expect(vaultCache.upsertItems).toHaveBeenCalledOnce();
  });

  it('force=true ignores cached meta', async () => {
    vi.mocked(vaultCache.getSyncMeta).mockResolvedValue({
      lastSyncedAt: '2025-01-01T00:00:00Z',
      syncedAt: 1,
    });
    vi.mocked(api.getUserItems).mockResolvedValue({ items: [], nextCursor: null } as never);

    const { engine } = makeEngine();
    await engine.runOnce({ force: true });

    expect(api.getUserItemsDelta).not.toHaveBeenCalled();
    expect(api.getUserItems).toHaveBeenCalled();
  });

  it('emits failed when api throws while online', async () => {
    vi.mocked(vaultCache.getSyncMeta).mockResolvedValue(null);
    vi.mocked(api.getUserItems).mockRejectedValue(new Error('boom'));

    const { engine, events } = makeEngine();
    await engine.runOnce();

    expect(events.map((e) => e.type)).toEqual(['started', 'failed']);
    const failed = events.find((e) => e.type === 'failed');
    expect(failed && 'error' in failed && failed.error.message).toBe('boom');
  });

  it('wraps non-Error thrown value in Error', async () => {
    vi.mocked(vaultCache.getSyncMeta).mockResolvedValue(null);
    vi.mocked(api.getUserItems).mockRejectedValue('string rejection');

    const { engine, events } = makeEngine();
    await engine.runOnce();

    expect(events.map((e) => e.type)).toEqual(['started', 'failed']);
    const failed = events.find((e) => e.type === 'failed');
    expect(failed && 'error' in failed && failed.error).toBeInstanceOf(Error);
  });

  it('emits offline when api throws and navigator goes offline mid-flight', async () => {
    vi.mocked(vaultCache.getSyncMeta).mockResolvedValue(null);
    vi.mocked(api.getUserItems).mockImplementation(() => {
      Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
      return Promise.reject(new Error('network'));
    });

    const { engine, events } = makeEngine();
    await engine.runOnce();

    expect(events.map((e) => e.type)).toEqual(['started', 'offline']);
  });

  it('coalesces concurrent runs', async () => {
    vi.mocked(vaultCache.getSyncMeta).mockResolvedValue(null);
    vi.mocked(api.getUserItems).mockResolvedValue({ items: [], nextCursor: null } as never);

    const { engine } = makeEngine();
    const p1 = engine.runOnce();
    const p2 = engine.runOnce();
    expect(p1).toBe(p2);
    await p1;
    expect(api.getUserItems).toHaveBeenCalledOnce();
  });

  it('subscribe returns unsubscribe', async () => {
    vi.mocked(vaultCache.getSyncMeta).mockResolvedValue(null);
    vi.mocked(api.getUserItems).mockResolvedValue({ items: [], nextCursor: null } as never);

    const qc = new QueryClient();
    const engine = createDefaultSyncEngine(qc);
    const fn = vi.fn();
    const unsub = engine.subscribe(fn);
    unsub();
    await engine.runOnce();
    expect(fn).not.toHaveBeenCalled();
  });
});
