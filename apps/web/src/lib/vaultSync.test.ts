import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';

// Hoist mocks so they resolve before imports
const mockGetItems = vi.fn();
const mockGetItemsDelta = vi.fn();
const mockGetSession = vi.fn();

vi.mock('@/lib/api', () => ({ api: { getItems: mockGetItems, getItemsDelta: mockGetItemsDelta } }));
vi.mock('@/lib/session', () => ({ session: { get: mockGetSession } }));
vi.mock('@/lib/fetchAllPages', () => ({
  fetchAllPages: vi.fn((fn: (cursor?: string) => Promise<{ data: unknown[]; nextCursor: null }>) =>
    fn().then((r) => r.data),
  ),
}));

// Import after mocks
const { vaultSync } = await import('./vaultSync');
const { vaultCache } = await import('./vaultCache');

const VAULT_ID = 'v1';

function makeItem(id: string) {
  return {
    id,
    encryptedData: { ciphertext: 'c', nonce: 'n' },
    encryptedItemKey: { ciphertext: 'kc', nonce: 'kn' },
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
  };
}

beforeEach(() => {
  vi.stubGlobal('indexedDB', new IDBFactory());
  Object.defineProperty(navigator, 'onLine', { value: true, writable: true, configurable: true });
  mockGetSession.mockReturnValue({ keychain: {}, activeVaultId: VAULT_ID });
  mockGetItems.mockResolvedValue({ items: [makeItem('a'), makeItem('b')], nextCursor: null });
  mockGetItemsDelta.mockResolvedValue({
    items: [makeItem('c')],
    deletedIds: ['a'],
    serverTime: '2025-06-01T00:00:00Z',
  });
});

afterEach(() => {
  vaultSync.stopPolling();
  vi.clearAllMocks();
});

describe('full sync (no prior meta)', () => {
  it('fetches all items, writes to cache, sets syncMeta', async () => {
    await vaultSync.sync(VAULT_ID);

    const cached = await vaultCache.getItems(VAULT_ID);
    expect(cached.map((i) => i.id).sort()).toEqual(['a', 'b']);

    const meta = await vaultCache.getSyncMeta(VAULT_ID);
    expect(meta).not.toBeNull();
    expect(meta?.vaultId).toBe(VAULT_ID);
  });

  it('transitions status idle → syncing → idle', async () => {
    const states: string[] = [];
    vaultSync.subscribe((s) => states.push(s.status));
    await vaultSync.sync(VAULT_ID);
    expect(states).toEqual(['syncing', 'idle']);
  });
});

describe('delta sync (meta exists)', () => {
  it('calls getItemsDelta with lastSyncedAt, upserts changed, deletes removed', async () => {
    await vaultCache.setSyncMeta({
      vaultId: VAULT_ID,
      lastSyncedAt: '2025-01-01T00:00:00Z',
      syncedAt: 0,
    });
    await vaultCache.upsertItems([
      {
        id: 'a',
        vaultId: VAULT_ID,
        encryptedData: { ciphertext: 'c', nonce: 'n' },
        encryptedItemKey: { ciphertext: 'kc', nonce: 'kn' },
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
      },
    ]);

    await vaultSync.sync(VAULT_ID);

    expect(mockGetItemsDelta).toHaveBeenCalledWith(VAULT_ID, '2025-01-01T00:00:00Z');
    const cached = await vaultCache.getItems(VAULT_ID);
    expect(cached.map((i) => i.id)).toEqual(['c']); // 'a' deleted, 'c' added
  });
});

describe('force sync', () => {
  it('ignores existing meta and does full fetch', async () => {
    await vaultCache.setSyncMeta({
      vaultId: VAULT_ID,
      lastSyncedAt: '2025-01-01T00:00:00Z',
      syncedAt: 0,
    });
    await vaultSync.sync(VAULT_ID, true);
    expect(mockGetItems).toHaveBeenCalled();
    expect(mockGetItemsDelta).not.toHaveBeenCalled();
  });
});

describe('offline', () => {
  it('sets status to offline when navigator.onLine is false', async () => {
    Object.defineProperty(navigator, 'onLine', {
      value: false,
      writable: true,
      configurable: true,
    });
    const states: string[] = [];
    vaultSync.subscribe((s) => states.push(s.status));
    await vaultSync.sync(VAULT_ID);
    expect(states).toContain('offline');
    expect(mockGetItems).not.toHaveBeenCalled();
  });
});

describe('error handling', () => {
  it('sets status to error when fetch throws', async () => {
    mockGetItems.mockRejectedValue(new Error('Network error'));
    const states: string[] = [];
    const errors: (string | null)[] = [];
    vaultSync.subscribe((s) => {
      states.push(s.status);
      errors.push(s.error);
    });
    await vaultSync.sync(VAULT_ID);
    expect(states).toContain('error');
    expect(errors[errors.length - 1]).toBe('Network error');
  });
});

describe('subscribe / unsubscribe', () => {
  it('unsubscribe stops notifications', async () => {
    const states: string[] = [];
    const unsub = vaultSync.subscribe((s) => states.push(s.status));
    unsub();
    await vaultSync.sync(VAULT_ID);
    expect(states).toEqual([]);
  });
});

describe('concurrent sync guard', () => {
  it('ignores second sync call while first is running', async () => {
    // Delay getItems to keep syncing state alive
    let resolve!: () => void;
    mockGetItems.mockReturnValue(
      new Promise<{ items: ReturnType<typeof makeItem>[]; nextCursor: null }>((res) => {
        resolve = () => res({ items: [], nextCursor: null });
      }),
    );
    const p1 = vaultSync.sync(VAULT_ID);
    const p2 = vaultSync.sync(VAULT_ID); // should return immediately
    resolve();
    await Promise.all([p1, p2]);
    expect(mockGetItems).toHaveBeenCalledTimes(1);
  });
});

describe('startPolling / stopPolling', () => {
  it('runs initial sync and calls qc.invalidateQueries on success', async () => {
    const qc = {
      invalidateQueries: vi.fn(),
    } as unknown as import('@tanstack/react-query').QueryClient;
    vaultSync.startPolling(VAULT_ID, qc);
    await vi.waitFor(() =>
      expect(qc.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['vaultItems'] }),
    );
  });

  it('fires sync on online event', async () => {
    const qc = {
      invalidateQueries: vi.fn(),
    } as unknown as import('@tanstack/react-query').QueryClient;
    vaultSync.startPolling(VAULT_ID, qc);
    // initial sync: no meta → full fetch
    await vi.waitFor(() => expect(mockGetItems).toHaveBeenCalledTimes(1));
    // after full sync, meta exists → next sync uses delta path
    mockGetItemsDelta.mockClear();
    window.dispatchEvent(new Event('online'));
    await vi.waitFor(() => expect(mockGetItemsDelta).toHaveBeenCalledTimes(1));
  });

  it('stopPolling removes online listener so subsequent online events are ignored', async () => {
    const qc = {
      invalidateQueries: vi.fn(),
    } as unknown as import('@tanstack/react-query').QueryClient;
    vaultSync.startPolling(VAULT_ID, qc);
    await vi.waitFor(() => expect(mockGetItems).toHaveBeenCalledTimes(1));
    vaultSync.stopPolling();
    mockGetItemsDelta.mockClear();
    window.dispatchEvent(new Event('online'));
    await new Promise((r) => setTimeout(r, 20));
    expect(mockGetItemsDelta).not.toHaveBeenCalled();
  });

  it('polls on interval when session has keychain', async () => {
    let pollCb: (() => void) | undefined;
    const setIntervalSpy = vi
      .spyOn(globalThis, 'setInterval')
      .mockImplementation((fn: TimerHandler) => {
        pollCb = fn as () => void;
        return 0 as unknown as ReturnType<typeof setInterval>;
      });

    const qc = {
      invalidateQueries: vi.fn(),
    } as unknown as import('@tanstack/react-query').QueryClient;
    vaultSync.startPolling(VAULT_ID, qc);
    // wait for initial full sync
    await vi.waitFor(() => expect(mockGetItems).toHaveBeenCalledTimes(1));
    mockGetItemsDelta.mockClear();

    // simulate interval fire — meta now exists, uses delta path
    pollCb!();
    await vi.waitFor(() => expect(mockGetItemsDelta).toHaveBeenCalledTimes(1));

    setIntervalSpy.mockRestore();
  });
});

describe('delta sync empty delta', () => {
  it('handles delta with no changed or deleted items', async () => {
    mockGetItemsDelta.mockResolvedValue({
      items: [],
      deletedIds: [],
      serverTime: '2025-06-01T00:00:00Z',
    });
    await vaultCache.setSyncMeta({
      vaultId: VAULT_ID,
      lastSyncedAt: '2025-01-01T00:00:00Z',
      syncedAt: 0,
    });
    await vaultSync.sync(VAULT_ID);
    expect(vaultSync.getState().status).toBe('idle');
    expect(vaultSync.getState().error).toBeNull();
  });
});

describe('offline during error', () => {
  it('sets status to offline when navigator goes offline during fetch', async () => {
    // Change onLine to false INSIDE the mock (after the early-check at line 41 passes)
    mockGetItems.mockImplementation(() => {
      Object.defineProperty(navigator, 'onLine', {
        value: false,
        configurable: true,
        writable: true,
      });
      return Promise.reject(new Error('connection dropped'));
    });
    const states: string[] = [];
    vaultSync.subscribe((s) => states.push(s.status));
    await vaultSync.sync(VAULT_ID);
    expect(states).toContain('offline');
    expect(vaultSync.getState().status).toBe('offline');
    // restore for subsequent tests
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true, writable: true });
  });

  it('uses "Sync failed" message for non-Error throws', async () => {
    mockGetItems.mockRejectedValue('not an Error object');
    const errors: (string | null)[] = [];
    vaultSync.subscribe((s) => errors.push(s.error));
    await vaultSync.sync(VAULT_ID);
    expect(errors[errors.length - 1]).toBe('Sync failed');
  });
});

describe('interval no-keychain', () => {
  it('does not sync from interval when session has no keychain', async () => {
    let pollCb: (() => void) | undefined;
    const setIntervalSpy = vi
      .spyOn(globalThis, 'setInterval')
      .mockImplementation((fn: TimerHandler) => {
        pollCb = fn as () => void;
        return 0 as unknown as ReturnType<typeof setInterval>;
      });

    const qc = {
      invalidateQueries: vi.fn(),
    } as unknown as import('@tanstack/react-query').QueryClient;
    vaultSync.startPolling(VAULT_ID, qc);
    await vi.waitFor(() => expect(mockGetItems).toHaveBeenCalledTimes(1));

    // Simulate logout (no keychain)
    mockGetSession.mockReturnValue(null);
    mockGetItemsDelta.mockClear();

    pollCb!();
    await new Promise((r) => setTimeout(r, 20));
    expect(mockGetItemsDelta).not.toHaveBeenCalled();

    setIntervalSpy.mockRestore();
  });
});
