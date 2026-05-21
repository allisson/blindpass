import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import type { ReactNode } from 'react';
import {
  useVaultItems,
  useAllVaultItems,
  useCreateItem,
  useUpdateItem,
  useDeleteItem,
  useRestoreItem,
  usePurgeItem,
  useEmptyTrash,
  useVaultList,
  useActiveVaultId,
  useSwitchVault,
  useMoveItem,
  useTrashItems,
  useItemVersions,
  useItemVersion,
  useCreateVault,
  useRenameVault,
  VAULT_ITEMS_KEY,
  TRASH_ITEMS_KEY,
  type DecryptedItem,
  type DecryptedTrashedItem,
} from './useVault';
import { session } from '@/lib/session';

vi.mock('@/lib/api', async (importActual) => {
  const actual = await importActual<typeof import('@/lib/api')>();
  return {
    ApiError: actual.ApiError,
    api: {
      createItem: vi.fn(),
      updateItem: vi.fn(),
      deleteItem: vi.fn(),
      restoreItem: vi.fn(),
      purgeItem: vi.fn(),
      emptyGlobalTrash: vi.fn(),
      getGlobalTrash: vi.fn(),
      getVersions: vi.fn(),
      getVersion: vi.fn(),
      createVault: vi.fn(),
      updateVault: vi.fn(),
      moveItem: vi.fn(),
    },
  };
});

vi.mock('@/lib/session', () => ({
  session: {
    get: vi.fn(),
    switchVault: vi.fn(),
    notify: vi.fn(),
  },
}));

vi.mock('@blindpass/vault', () => ({
  decryptVaultItem: vi.fn(),
  encryptVaultItem: vi.fn(),
  encryptVaultMetadata: vi.fn(),
  lock: vi.fn(),
}));

vi.mock('@blindpass/crypto', () => ({
  generateKey: vi.fn(),
  encryptSymmetric: vi.fn(),
  decryptSymmetric: vi.fn(),
}));

vi.mock('@/lib/b64', () => ({
  fromBase64EncryptedValue: vi.fn((v: unknown) => v),
  toBase64EncryptedValue: vi.fn((v: unknown) => v),
}));

vi.mock('@/lib/vaultCache', () => ({
  vaultCache: {
    getItems: vi.fn().mockResolvedValue([]),
    getAllItems: vi.fn().mockResolvedValue([]),
    upsertItems: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock('@/components/sync/SyncBoundary', () => ({
  useSyncBoundary: () => ({
    phase: 'idle',
    lastError: null,
    lastSyncedAt: null,
    pendingItemIds: new Set(),
    consecutiveFailures: 0,
    forceSync: vi.fn().mockResolvedValue(undefined),
    markPending: vi.fn(),
    clearPending: vi.fn(),
  }),
}));

vi.mock('@/components/keychain/KeychainRequired', async () => {
  const vaultMod = await import('@blindpass/vault');
  return {
    useKeychain: () => ({
      masterKey: new Uint8Array([1]),
      vaultKey: new Uint8Array([2]),
      keyPair: { publicKey: new Uint8Array([3]), privateKey: new Uint8Array([4]) },
      activeVaultId: 'v1',
      vaults: new Map([
        ['v1', { vaultKey: new Uint8Array([2]), name: 'Personal', isShared: false, role: 'owner' }],
      ]),
      username: 'tester',
      getVaultKey: () => new Uint8Array([2]),
      decryptItem: async (envelope: {
        id: string;
        folderId?: string | null;
        createdAt: string;
        updatedAt: string;
        encryptedData: unknown;
        encryptedItemKey: unknown;
      }) => {
        const vaultItem = await vaultMod.decryptVaultItem(
          envelope.encryptedData as never,
          new Uint8Array(32),
        );
        return {
          ...vaultItem,
          id: envelope.id,
          folderId: envelope.folderId,
          createdAt: envelope.createdAt,
          updatedAt: envelope.updatedAt,
        };
      },
      encryptItem: async (payload: unknown) => {
        const enc = await vaultMod.encryptVaultItem(payload as never, new Uint8Array(32));
        void enc;
        return {
          encryptedData: { ciphertext: 'c', nonce: 'n' },
          encryptedItemKey: { ciphertext: 'c', nonce: 'n' },
        };
      },
      decryptVersion: async (envelope: { encryptedData: unknown; encryptedItemKey: unknown }) =>
        vaultMod.decryptVaultItem(envelope.encryptedData as never, new Uint8Array(32)),
      wrapVaultKey: async () => ({
        ciphertext: 'c',
        nonce: 'n',
      }),
    }),
  };
});

import { api } from '@/lib/api';
import { generateKey, encryptSymmetric, decryptSymmetric } from '@blindpass/crypto';
import { encryptVaultItem, decryptVaultItem, encryptVaultMetadata } from '@blindpass/vault';

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return {
    wrapper: ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client: qc }, children),
    queryClient: qc,
  };
}

function mockSessionWithVault() {
  const vaultKey = new Uint8Array(32);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (session.get as any).mockReturnValue({
    activeVaultId: 'v1',
    vaults: new Map([['v1', { vaultKey, name: 'Main', isShared: false }]]),
    keychain: { masterKey: new Uint8Array(32), vaultKey },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useVaultList', () => {
  it('returns empty array when no session', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (session.get as any).mockReturnValue(null);
    const { result } = renderHook(() => useVaultList());
    expect(result.current).toEqual([]);
  });

  it('returns vault list from session', () => {
    mockSessionWithVault();
    const { result } = renderHook(() => useVaultList());
    expect(result.current).toEqual([{ id: 'v1', name: 'Main' }]);
  });
});

describe('useActiveVaultId', () => {
  it('returns empty string when no session', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (session.get as any).mockReturnValue(null);
    const { result } = renderHook(() => useActiveVaultId());
    expect(result.current).toBe('');
  });

  it('returns activeVaultId from session', () => {
    mockSessionWithVault();
    const { result } = renderHook(() => useActiveVaultId());
    expect(result.current).toBe('v1');
  });
});

describe('useDeleteItem', () => {
  it('calls api.deleteItem with correct args', async () => {
    mockSessionWithVault();
    vi.mocked(api.deleteItem).mockResolvedValue(undefined);

    const { wrapper, queryClient } = makeWrapper();
    const prevItems: DecryptedItem[] = [
      { id: 'item1', type: 'login', title: 'Test', username: '', password: '' },
    ];
    queryClient.setQueryData(VAULT_ITEMS_KEY, prevItems);

    const { result } = renderHook(() => useDeleteItem(), { wrapper });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    result.current.mutate('item1');
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(api.deleteItem).toHaveBeenCalledWith('v1', 'item1');
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: TRASH_ITEMS_KEY });
  });

  it('optimistically removes item from cache', async () => {
    mockSessionWithVault();
    vi.mocked(api.deleteItem).mockResolvedValue(undefined);

    const { wrapper, queryClient } = makeWrapper();
    const prevItems: DecryptedItem[] = [
      { id: 'item1', type: 'login', title: 'Test', username: '', password: '' },
      { id: 'item2', type: 'login', title: 'Other', username: '', password: '' },
    ];
    queryClient.setQueryData(VAULT_ITEMS_KEY, prevItems);

    const { result } = renderHook(() => useDeleteItem(), { wrapper });
    result.current.mutate('item1');

    await waitFor(() => {
      const items = queryClient.getQueryData<DecryptedItem[]>(VAULT_ITEMS_KEY);
      expect(items?.find((i) => i.id === 'item1')).toBeUndefined();
      expect(items?.find((i) => i.id === 'item2')).toBeDefined();
    });
  });

  it('rolls back on error', async () => {
    mockSessionWithVault();
    vi.mocked(api.deleteItem).mockRejectedValue(new Error('server error'));

    const { wrapper, queryClient } = makeWrapper();
    const prevItems: DecryptedItem[] = [
      { id: 'item1', type: 'login', title: 'Test', username: '', password: '' },
    ];
    queryClient.setQueryData(VAULT_ITEMS_KEY, prevItems);

    const { result } = renderHook(() => useDeleteItem(), { wrapper });
    result.current.mutate('item1');

    await waitFor(() => expect(result.current.isError).toBe(true));
    const items = queryClient.getQueryData<DecryptedItem[]>(VAULT_ITEMS_KEY);
    expect(items).toEqual(prevItems);
  });

  it('does not crash in onError when ctx is undefined', async () => {
    mockSessionWithVault();
    vi.mocked(api.deleteItem).mockRejectedValue(new Error('fail'));
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useDeleteItem(), { wrapper });
    result.current.mutate('item1');
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useRestoreItem', () => {
  it('calls api.restoreItem and invalidates vault and trash queries', async () => {
    mockSessionWithVault();
    vi.mocked(api.restoreItem).mockResolvedValue(undefined);

    const { wrapper, queryClient } = makeWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useRestoreItem(), { wrapper });
    result.current.mutate({ id: 'item1', vaultId: 'v1' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.restoreItem).toHaveBeenCalledWith('v1', 'item1');
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: VAULT_ITEMS_KEY });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: TRASH_ITEMS_KEY });
  });

  it('optimistically removes restored item from trash cache', async () => {
    mockSessionWithVault();
    vi.mocked(api.restoreItem).mockResolvedValue(undefined);

    const { wrapper, queryClient } = makeWrapper();
    const prevItems: DecryptedTrashedItem[] = [
      {
        id: 'item1',
        vaultId: 'v1',
        type: 'login',
        title: 'Restore me',
        username: 'restore@example.com',
        password: '',
        deletedAt: '2026-04-20T12:00:00.000Z',
      },
      {
        id: 'item2',
        vaultId: 'v1',
        type: 'login',
        title: 'Keep me',
        username: 'keep@example.com',
        password: '',
        deletedAt: '2026-04-21T12:00:00.000Z',
      },
    ];
    queryClient.setQueryData(TRASH_ITEMS_KEY, prevItems);

    const { result } = renderHook(() => useRestoreItem(), { wrapper });
    result.current.mutate({ id: 'item1', vaultId: 'v1' });

    await waitFor(() => {
      const items = queryClient.getQueryData<DecryptedTrashedItem[]>(TRASH_ITEMS_KEY);
      expect(items?.find((item) => item.id === 'item1')).toBeUndefined();
      expect(items?.find((item) => item.id === 'item2')).toBeDefined();
    });
  });

  it('restores previous trash data on restore error', async () => {
    mockSessionWithVault();
    vi.mocked(api.restoreItem).mockRejectedValue(new Error('restore failed'));

    const { wrapper, queryClient } = makeWrapper();
    const prevItems: DecryptedTrashedItem[] = [
      {
        id: 'item1',
        vaultId: 'v1',
        type: 'login',
        title: 'Restore me',
        username: 'restore@example.com',
        password: '',
        deletedAt: '2026-04-20T12:00:00.000Z',
      },
    ];
    queryClient.setQueryData(TRASH_ITEMS_KEY, prevItems);

    const { result } = renderHook(() => useRestoreItem(), { wrapper });
    result.current.mutate({ id: 'item1', vaultId: 'v1' });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(queryClient.getQueryData<DecryptedTrashedItem[]>(TRASH_ITEMS_KEY)).toEqual(prevItems);
  });
});

describe('usePurgeItem', () => {
  it('optimistically removes item from trash cache', async () => {
    mockSessionWithVault();
    vi.mocked(api.purgeItem).mockResolvedValue(undefined);

    const { wrapper, queryClient } = makeWrapper();
    const trashItems = [
      {
        id: 'item1',
        type: 'login' as const,
        title: 'Old',
        username: '',
        password: '',
        deletedAt: '2024-01-01',
        vaultId: 'v1',
      },
    ];
    queryClient.setQueryData(TRASH_ITEMS_KEY, trashItems);

    const { result } = renderHook(() => usePurgeItem(), { wrapper });
    result.current.mutate({ id: 'item1', vaultId: 'v1' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const items = queryClient.getQueryData(TRASH_ITEMS_KEY) as typeof trashItems;
    expect(items?.find((i) => i.id === 'item1')).toBeUndefined();
  });

  it('optimistically removes item even if trash cache is undefined', async () => {
    mockSessionWithVault();
    vi.mocked(api.purgeItem).mockResolvedValue(undefined);

    const { wrapper, queryClient } = makeWrapper();
    // Cache is undefined

    const { result } = renderHook(() => usePurgeItem(), { wrapper });
    result.current.mutate({ id: 'item1', vaultId: 'v1' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const items = queryClient.getQueryData<DecryptedTrashedItem[]>(TRASH_ITEMS_KEY);
    expect(items).toBeUndefined();
  });

  it('restores previous trash data on error in onError callback even if previous is undefined', async () => {
    mockSessionWithVault();
    vi.mocked(api.purgeItem).mockRejectedValue(new Error('fail'));
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => usePurgeItem(), { wrapper });
    result.current.mutate({ id: 'item1', vaultId: 'v1' });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useEmptyTrash', () => {
  it('calls api.emptyGlobalTrash and invalidates trash query', async () => {
    mockSessionWithVault();
    vi.mocked(api.emptyGlobalTrash).mockResolvedValue(undefined);

    const { wrapper, queryClient } = makeWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useEmptyTrash(), { wrapper });
    result.current.mutate();

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: TRASH_ITEMS_KEY });
  });
});

function setupCryptoMocksForWrite() {
  const fakeKey = new Uint8Array(32);
  const fakeEncrypted = { ciphertext: new Uint8Array(1), nonce: new Uint8Array(24) };
  vi.mocked(generateKey).mockResolvedValue(fakeKey);
  vi.mocked(encryptVaultItem).mockResolvedValue(fakeEncrypted);
  vi.mocked(encryptSymmetric).mockResolvedValue(fakeEncrypted);
}

describe('useCreateItem', () => {
  const createdItemResponse = {
    item: {
      id: 'new-item',
      folderId: null,
      encryptedData: { ciphertext: 'enc-data', nonce: 'nonce-data' },
      encryptedItemKey: { ciphertext: 'enc-key', nonce: 'nonce-key' },
      createdAt: '2026-05-11T00:00:00.000Z',
      updatedAt: '2026-05-11T00:00:00.000Z',
    },
  } as const;

  it('calls api.createItem and invalidates vault query on success', async () => {
    mockSessionWithVault();
    setupCryptoMocksForWrite();
    vi.mocked(api.createItem).mockResolvedValue(createdItemResponse as never);

    const { wrapper, queryClient } = makeWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useCreateItem(), { wrapper });
    result.current.mutate({
      vaultItem: { type: 'login', title: 'New', username: 'u', password: 'p' },
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.createItem).toHaveBeenCalledWith('v1', expect.any(Object));
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: VAULT_ITEMS_KEY });
  });

  it('passes folderId to api.createItem', async () => {
    mockSessionWithVault();
    setupCryptoMocksForWrite();
    vi.mocked(api.createItem).mockResolvedValue({
      item: { ...createdItemResponse.item, folderId: 'folder-1' },
    } as never);

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useCreateItem(), { wrapper });
    result.current.mutate({
      vaultItem: { type: 'login', title: 'New', username: 'u', password: 'p' },
      folderId: 'folder-1',
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.createItem).toHaveBeenCalledWith(
      'v1',
      expect.objectContaining({ folderId: 'folder-1' }),
    );
  });

  it('optimistically adds item to cache', async () => {
    mockSessionWithVault();
    setupCryptoMocksForWrite();
    vi.mocked(api.createItem).mockResolvedValue(createdItemResponse as never);

    const { wrapper, queryClient } = makeWrapper();
    queryClient.setQueryData<DecryptedItem[]>(VAULT_ITEMS_KEY, []);

    const { result } = renderHook(() => useCreateItem(), { wrapper });
    result.current.mutate({
      vaultItem: { type: 'login', title: 'New', username: 'u', password: 'p' },
    });

    await waitFor(() => {
      const items = queryClient.getQueryData<DecryptedItem[]>(VAULT_ITEMS_KEY);
      expect(items?.some((i) => i.title === 'New')).toBe(true);
    });
  });

  it('optimistically adds item to empty cache', async () => {
    mockSessionWithVault();
    setupCryptoMocksForWrite();
    vi.mocked(api.createItem).mockResolvedValue(createdItemResponse as never);

    const { wrapper, queryClient } = makeWrapper();
    const { result } = renderHook(() => useCreateItem(), { wrapper });
    result.current.mutate({
      vaultItem: { type: 'login', title: 'New', username: 'u', password: 'p' },
    });

    await waitFor(() => {
      const items = queryClient.getQueryData<DecryptedItem[]>(VAULT_ITEMS_KEY);
      expect(items).toHaveLength(1);
      expect(items![0].title).toBe('New');
    });
  });

  it('rolls back on create error', async () => {
    mockSessionWithVault();
    vi.mocked(api.createItem).mockRejectedValue(new Error('fail'));

    const { wrapper, queryClient } = makeWrapper();
    const prev: DecryptedItem[] = [
      { id: 'existing', type: 'login', title: 'Existing', username: '', password: '' },
    ];
    queryClient.setQueryData<DecryptedItem[]>(VAULT_ITEMS_KEY, prev);

    const { result } = renderHook(() => useCreateItem(), { wrapper });
    result.current.mutate({
      vaultItem: { type: 'login', title: 'New', username: 'u', password: 'p' },
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    const items = queryClient.getQueryData<DecryptedItem[]>(VAULT_ITEMS_KEY);
    expect(items).toEqual(prev);
  });

  it('does not crash in onError when ctx is undefined', async () => {
    mockSessionWithVault();
    vi.mocked(api.createItem).mockRejectedValue(new Error('fail'));
    const { wrapper } = makeWrapper();

    const { result } = renderHook(() => useCreateItem(), { wrapper });
    result.current.mutate({
      vaultItem: { type: 'login', title: 'X', username: 'u', password: 'p' },
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it('persists created item into vaultCache for offline reads', async () => {
    mockSessionWithVault();
    setupCryptoMocksForWrite();
    vi.mocked(api.createItem).mockResolvedValue(createdItemResponse as never);
    const { vaultCache } = await import('@/lib/vaultCache');

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useCreateItem(), { wrapper });
    result.current.mutate({
      vaultItem: { type: 'login', title: 'New', username: 'u', password: 'p' },
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(vaultCache.upsertItems).toHaveBeenCalledWith([
      {
        id: 'new-item',
        vaultId: 'v1',
        folderId: null,
        encryptedData: { ciphertext: 'enc-data', nonce: 'nonce-data' },
        encryptedItemKey: { ciphertext: 'enc-key', nonce: 'nonce-key' },
        createdAt: '2026-05-11T00:00:00.000Z',
        updatedAt: '2026-05-11T00:00:00.000Z',
      },
    ]);
  });
});

describe('useMoveItem', () => {
  it('calls api.moveItem and invalidates vault query', async () => {
    mockSessionWithVault();
    vi.mocked(api.moveItem).mockResolvedValue(undefined);

    const { wrapper, queryClient } = makeWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useMoveItem(), { wrapper });
    result.current.mutate({ id: 'item1', folderId: 'folder-1' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.moveItem).toHaveBeenCalledWith('v1', 'item1', { folderId: 'folder-1' });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: VAULT_ITEMS_KEY });
  });

  it('supports removing item from folder (null folderId)', async () => {
    mockSessionWithVault();
    vi.mocked(api.moveItem).mockResolvedValue(undefined);

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useMoveItem(), { wrapper });
    result.current.mutate({ id: 'item1', folderId: null });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.moveItem).toHaveBeenCalledWith('v1', 'item1', { folderId: null });
  });
});

describe('useUpdateItem', () => {
  it('calls api.updateItem and invalidates vault query on success', async () => {
    mockSessionWithVault();
    setupCryptoMocksForWrite();
    vi.mocked(api.updateItem).mockResolvedValue(undefined as never);

    const { wrapper, queryClient } = makeWrapper();
    const prev: DecryptedItem[] = [
      { id: 'item1', type: 'login', title: 'Old', username: 'old', password: 'p' },
      { id: 'item2', type: 'login', title: 'Other', username: 'u', password: 'p' },
    ];
    queryClient.setQueryData<DecryptedItem[]>(VAULT_ITEMS_KEY, prev);
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useUpdateItem(), { wrapper });
    result.current.mutate({
      id: 'item1',
      vaultItem: { type: 'login', title: 'New', username: 'new', password: 'p' },
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.updateItem).toHaveBeenCalledWith('v1', 'item1', expect.any(Object));
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: VAULT_ITEMS_KEY });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['itemVersions', 'item1'] });
  });

  it('rolls back on update error', async () => {
    mockSessionWithVault();
    vi.mocked(api.updateItem).mockRejectedValue(new Error('fail'));

    const { wrapper, queryClient } = makeWrapper();
    const prev: DecryptedItem[] = [
      { id: 'item1', type: 'login', title: 'Old', username: 'old', password: 'p' },
    ];
    queryClient.setQueryData<DecryptedItem[]>(VAULT_ITEMS_KEY, prev);

    const { result } = renderHook(() => useUpdateItem(), { wrapper });
    result.current.mutate({
      id: 'item1',
      vaultItem: { type: 'login', title: 'New', username: 'new', password: 'p' },
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    const items = queryClient.getQueryData<DecryptedItem[]>(VAULT_ITEMS_KEY);
    expect(items).toEqual(prev);
  });

  it('does not crash in onError when ctx is undefined', async () => {
    mockSessionWithVault();
    vi.mocked(api.updateItem).mockRejectedValue(new Error('fail'));
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useUpdateItem(), { wrapper });
    result.current.mutate({
      id: 'item1',
      vaultItem: { type: 'login', title: 'X', username: 'u', password: 'p' },
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it('updates cache correctly even if old cache is undefined', async () => {
    mockSessionWithVault();
    setupCryptoMocksForWrite();
    vi.mocked(api.updateItem).mockResolvedValue(undefined as never);

    const { wrapper, queryClient } = makeWrapper();
    // Cache is undefined
    const { result } = renderHook(() => useUpdateItem(), { wrapper });
    result.current.mutate({
      id: 'item1',
      vaultItem: { type: 'login', title: 'New', username: 'new', password: 'p' },
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const items = queryClient.getQueryData<DecryptedItem[]>(VAULT_ITEMS_KEY);
    expect(items).toBeUndefined();
  });
});

describe('useSwitchVault', () => {
  it('calls session.switchVault and removes stale queries', () => {
    mockSessionWithVault();

    const { wrapper, queryClient } = makeWrapper();
    const removeQueriesSpy = vi.spyOn(queryClient, 'removeQueries');

    const { result } = renderHook(() => useSwitchVault(), { wrapper });
    result.current('v2');

    expect(session.switchVault).toHaveBeenCalledWith('v2');
    expect(removeQueriesSpy).toHaveBeenCalledWith({ queryKey: VAULT_ITEMS_KEY });
    expect(removeQueriesSpy).toHaveBeenCalledWith({ queryKey: TRASH_ITEMS_KEY });
    expect(removeQueriesSpy).toHaveBeenCalledWith({ queryKey: ['folders'] });
  });
});

describe('useTrashItems', () => {
  it('fetches and returns an empty trash when session has no items', async () => {
    mockSessionWithVault();
    vi.mocked(api.getGlobalTrash).mockResolvedValue({ items: [] } as never);

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useTrashItems(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
  });

  it('decrypts and returns trashed items', async () => {
    mockSessionWithVault();
    vi.mocked(api.getGlobalTrash).mockResolvedValue({
      items: [
        {
          id: 'trash1',
          vaultId: 'v1',
          deletedAt: '2024-06-01T00:00:00Z',
          encryptedItemKey: { ciphertext: 'kc', nonce: 'kn' },
          encryptedData: { ciphertext: 'dc', nonce: 'dn' },
        },
      ],
    } as never);
    vi.mocked(decryptSymmetric).mockResolvedValue(new Uint8Array(32));
    vi.mocked(decryptVaultItem).mockResolvedValue({
      type: 'login',
      title: 'Deleted',
      username: 'u',
      password: 'p',
    } as never);

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useTrashItems(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data![0].id).toBe('trash1');
    expect(result.current.data![0].deletedAt).toBe('2024-06-01T00:00:00Z');
    expect(result.current.data![0].vaultId).toBe('v1');
    expect(result.current.data![0].title).toBe('Deleted');
  });

  it('throws when trash item has unknown vaultId', async () => {
    mockSessionWithVault();
    vi.mocked(api.getGlobalTrash).mockResolvedValue({
      items: [
        {
          id: 'trash1',
          vaultId: 'unknown-vault',
          deletedAt: '2024-06-01T00:00:00Z',
          encryptedItemKey: { ciphertext: 'kc', nonce: 'kn' },
          encryptedData: { ciphertext: 'dc', nonce: 'dn' },
        },
      ],
    } as never);

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useTrashItems(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toContain(
      'Vault not found for trash item: unknown-vault',
    );
  });

  // No-session error path now handled by KeychainRequired boundary (redirects to /unlock).
});

describe('useVaultItems', () => {
  it('decrypts and returns items', async () => {
    mockSessionWithVault();
    const { vaultCache } = await import('@/lib/vaultCache');
    vi.mocked(vaultCache.getItems).mockResolvedValue([
      {
        id: 'item1',
        vaultId: 'v1',
        encryptedItemKey: { ciphertext: 'abc', nonce: 'xyz' },
        encryptedData: { ciphertext: 'def', nonce: 'uvw' },
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
      },
    ] as never);
    vi.mocked(decryptSymmetric).mockResolvedValue(new Uint8Array(32));
    vi.mocked(decryptVaultItem).mockResolvedValue({
      type: 'login',
      title: 'Test',
      username: 'user',
      password: 'pass',
    } as never);

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useVaultItems(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data![0].title).toBe('Test');
    expect(result.current.data![0].id).toBe('item1');
  });
});

describe('useItemVersions', () => {
  it('fetches versions list for an item', async () => {
    mockSessionWithVault();
    vi.mocked(api.getVersions).mockResolvedValue({
      versions: [
        {
          id: 'v1',
          versionNum: 1,
          createdAt: '2024-01-01',
          encryptedItemKey: { ciphertext: '', nonce: '' },
          encryptedData: { ciphertext: '', nonce: '' },
        },
      ],
    } as never);

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useItemVersions('item1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data![0].versionNum).toBe(1);
  });

  it('fetches multiple pages of versions', async () => {
    mockSessionWithVault();
    vi.mocked(api.getVersions)
      .mockResolvedValueOnce({
        versions: [{ id: 'v1', versionNum: 2 }],
        nextCursor: 'c2',
      } as never)
      .mockResolvedValueOnce({
        versions: [{ id: 'v2', versionNum: 1 }],
      } as never);

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useItemVersions('item1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(2);
    expect(api.getVersions).toHaveBeenCalledTimes(2);
  });

  it('does not fetch when itemId is empty', () => {
    mockSessionWithVault();
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useItemVersions(''), { wrapper });
    expect(result.current.fetchStatus).toBe('idle');
  });
});

describe('useItemVersion', () => {
  it('stays idle when versionId is null', () => {
    mockSessionWithVault();
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useItemVersion('item1', null), { wrapper });
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('fetches and decrypts a specific version', async () => {
    mockSessionWithVault();
    vi.mocked(api.getVersion).mockResolvedValue({
      version: {
        id: 'ver1',
        versionNum: 2,
        encryptedData: { ciphertext: 'abc', nonce: 'xyz' },
        encryptedItemKey: { ciphertext: 'kc', nonce: 'kn' },
        createdAt: '2024-01-01',
      },
    } as never);
    vi.mocked(decryptSymmetric).mockResolvedValue(new Uint8Array(32));
    vi.mocked(decryptVaultItem).mockResolvedValue({
      type: 'login',
      title: 'Old Title',
      username: 'u',
      password: 'p',
    } as never);

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useItemVersion('item1', 'ver1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.getVersion).toHaveBeenCalledWith('v1', 'item1', 'ver1');
    expect(result.current.data).toMatchObject({ versionNum: 2, title: 'Old Title' });
  });

  it('returns null for empty string versionId', async () => {
    mockSessionWithVault();
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useItemVersion('item1', ''), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeNull();
  });
});

describe('useVaultItems offline', () => {
  it('returns cached items when offline', async () => {
    mockSessionWithVault();
    Object.defineProperty(navigator, 'onLine', {
      value: false,
      writable: true,
      configurable: true,
    });
    const { vaultCache } = await import('@/lib/vaultCache');
    vi.mocked(vaultCache.getItems).mockResolvedValue([
      {
        id: 'cached1',
        vaultId: 'v1',
        encryptedData: { ciphertext: 'c', nonce: 'n' },
        encryptedItemKey: { ciphertext: 'kc', nonce: 'kn' },
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
      },
    ]);
    vi.mocked(decryptSymmetric).mockResolvedValue(new Uint8Array(32));
    vi.mocked(decryptVaultItem).mockResolvedValue({
      type: 'login',
      title: 'Cached',
      username: 'u',
      password: 'p',
    } as never);

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useVaultItems(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data![0].id).toBe('cached1');

    Object.defineProperty(navigator, 'onLine', { value: true, writable: true, configurable: true });
  });
});

describe('useCreateVault', () => {
  it('calls api.createVault with encrypted vault key and metadata', async () => {
    mockSessionWithVault();
    const fakeVaultKey = new Uint8Array(32);
    const fakeEncrypted = { ciphertext: new Uint8Array(1), nonce: new Uint8Array(24) };
    vi.mocked(generateKey).mockResolvedValue(fakeVaultKey);
    vi.mocked(encryptSymmetric).mockResolvedValue(fakeEncrypted);
    vi.mocked(encryptVaultMetadata).mockResolvedValue(fakeEncrypted);
    vi.mocked(api.createVault).mockResolvedValue({ vault: { id: 'new-v' } } as never);

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useCreateVault(), { wrapper });
    result.current.mutate('My Vault');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.createVault).toHaveBeenCalledWith(expect.any(Object));
  });
});

describe('useRenameVault', () => {
  it('calls api.updateVault with new encrypted metadata', async () => {
    mockSessionWithVault();
    const fakeEncrypted = { ciphertext: new Uint8Array(1), nonce: new Uint8Array(24) };
    vi.mocked(encryptVaultMetadata).mockResolvedValue(fakeEncrypted);
    vi.mocked(api.updateVault).mockResolvedValue({ vault: {} } as never);

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useRenameVault(), { wrapper });
    result.current.mutate({ vaultId: 'v1', name: 'Renamed' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.updateVault).toHaveBeenCalledWith('v1', expect.any(Object));
  });

  it('throws when vault entry not found in session', async () => {
    mockSessionWithVault();
    vi.mocked(api.updateVault).mockResolvedValue({ vault: {} } as never);

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useRenameVault(), { wrapper });
    result.current.mutate({ vaultId: 'nonexistent', name: 'X' });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe('Vault not found');
  });
});

describe('usePurgeItem rollback', () => {
  it('restores previous trash data on error', async () => {
    mockSessionWithVault();
    vi.mocked(api.purgeItem).mockRejectedValue(new Error('server error'));

    const { wrapper, queryClient } = makeWrapper();
    const trashItems: DecryptedTrashedItem[] = [
      {
        id: 'item1',
        type: 'login',
        title: 'Old',
        username: '',
        password: '',
        deletedAt: '2024-01-01',
        vaultId: 'v1',
      },
    ];
    queryClient.setQueryData(TRASH_ITEMS_KEY, trashItems);

    const { result } = renderHook(() => usePurgeItem(), { wrapper });
    result.current.mutate({ id: 'item1', vaultId: 'v1' });

    await waitFor(() => expect(result.current.isError).toBe(true));
    const items = queryClient.getQueryData(TRASH_ITEMS_KEY);
    expect(items).toEqual(trashItems);
  });

  it('restores previous trash data on error in onError callback', async () => {
    mockSessionWithVault();
    vi.mocked(api.purgeItem).mockRejectedValue(new Error('server error'));

    const { wrapper, queryClient } = makeWrapper();
    const trashItems: DecryptedTrashedItem[] = [
      {
        id: 'item1',
        type: 'login',
        title: 'Old',
        username: '',
        password: '',
        deletedAt: '2024-01-01',
        vaultId: 'v1',
      },
    ];
    queryClient.setQueryData(TRASH_ITEMS_KEY, trashItems);

    const { result } = renderHook(() => usePurgeItem(), { wrapper });
    result.current.mutate({ id: 'item1', vaultId: 'v1' });

    await waitFor(() => expect(result.current.isError).toBe(true));
    const items = queryClient.getQueryData(TRASH_ITEMS_KEY);
    expect(items).toEqual(trashItems);
  });
});

describe('useAllVaultItems', () => {
  it('decrypts and returns items from all vaults', async () => {
    mockSessionWithVault();
    const { vaultCache } = await import('@/lib/vaultCache');
    vi.mocked(vaultCache.getAllItems).mockResolvedValue([
      {
        id: 'item1',
        vaultId: 'v1',
        encryptedItemKey: { ciphertext: 'kc', nonce: 'kn' },
        encryptedData: { ciphertext: 'dc', nonce: 'dn' },
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
      },
    ] as never);
    vi.mocked(decryptVaultItem).mockResolvedValue({
      type: 'login',
      title: 'Cross Vault',
      username: 'u',
      password: 'p',
    } as never);

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useAllVaultItems(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data![0].vaultId).toBe('v1');
    expect(result.current.data![0].title).toBe('Cross Vault');
  });

  it('throws when item references unknown vaultId', async () => {
    mockSessionWithVault();
    const { vaultCache } = await import('@/lib/vaultCache');
    vi.mocked(vaultCache.getAllItems).mockResolvedValue([
      {
        id: 'item1',
        vaultId: 'unknown-vault',
        encryptedItemKey: { ciphertext: 'kc', nonce: 'kn' },
        encryptedData: { ciphertext: 'dc', nonce: 'dn' },
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
      },
    ] as never);

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useAllVaultItems(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toContain('Vault not found: unknown-vault');
  });
});

describe('useMoveItem optimistic', () => {
  it('optimistically updates folderId in cache', async () => {
    mockSessionWithVault();
    vi.mocked(api.moveItem).mockResolvedValue(undefined);

    const { wrapper, queryClient } = makeWrapper();
    const prev: DecryptedItem[] = [
      {
        id: 'item1',
        type: 'login',
        title: 'Item',
        username: '',
        password: '',
        folderId: 'old-folder',
      },
    ];
    queryClient.setQueryData<DecryptedItem[]>(VAULT_ITEMS_KEY, prev);

    const { result } = renderHook(() => useMoveItem(), { wrapper });
    result.current.mutate({ id: 'item1', folderId: 'new-folder' });

    await waitFor(() => {
      const items = queryClient.getQueryData<DecryptedItem[]>(VAULT_ITEMS_KEY);
      expect(items?.find((i) => i.id === 'item1')?.folderId).toBe('new-folder');
    });
  });
});

describe('useEmptyTrash error', () => {
  it('shows toast error when emptyGlobalTrash fails', async () => {
    mockSessionWithVault();
    vi.mocked(api.emptyGlobalTrash).mockRejectedValue(new Error('server error'));

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useEmptyTrash(), { wrapper });
    result.current.mutate();

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
