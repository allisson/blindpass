import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import type { ReactNode } from 'react';
import {
  useFolders,
  useCreateFolder,
  useRenameFolder,
  useDeleteFolder,
  FOLDERS_KEY,
} from './useFolders';
import { session } from '@/lib/session';

vi.mock('@/lib/api', () => ({
  api: {
    listFolders: vi.fn(),
    createFolder: vi.fn(),
    updateFolder: vi.fn(),
    deleteFolder: vi.fn(),
  },
}));

vi.mock('@/lib/session', () => ({
  session: {
    get: vi.fn(),
  },
}));

vi.mock('@blindpass/vault', () => ({
  encryptFolderName: vi.fn(),
  decryptFolderName: vi.fn(),
}));

vi.mock('@/lib/b64', () => ({
  fromBase64EncryptedValue: vi.fn((v: unknown) => v),
  toBase64EncryptedValue: vi.fn((v: unknown) => v),
}));

vi.mock('@/components/keychain/KeychainRequired', () => ({
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
    decryptItem: vi.fn(),
    encryptItem: vi.fn(),
  }),
}));

import { api } from '@/lib/api';
import { encryptFolderName, decryptFolderName } from '@blindpass/vault';

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return {
    wrapper: ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client: qc }, children),
    queryClient: qc,
  };
}

function mockSession() {
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

describe('useFolders', () => {
  it('fetches and decrypts folders', async () => {
    mockSession();
    vi.mocked(api.listFolders).mockResolvedValue({
      folders: [
        {
          id: 'f1',
          encryptedName: { ciphertext: 'abc', nonce: 'xyz' },
          createdAt: '2024-01-01',
          updatedAt: '2024-01-01',
        },
      ],
    } as never);
    vi.mocked(decryptFolderName).mockResolvedValue('Work');

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useFolders(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data![0]).toEqual({
      id: 'f1',
      name: 'Work',
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
    });
  });

  it('returns empty array when vault has no folders', async () => {
    mockSession();
    vi.mocked(api.listFolders).mockResolvedValue({ folders: [] } as never);

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useFolders(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
  });

  // No-session error path now handled by KeychainRequired boundary (redirects to /unlock).
});

describe('useCreateFolder', () => {
  it('encrypts the name, calls api.createFolder, and invalidates folders query', async () => {
    mockSession();
    const fakeEncrypted = { ciphertext: new Uint8Array(1), nonce: new Uint8Array(24) };
    vi.mocked(encryptFolderName).mockResolvedValue(fakeEncrypted);
    vi.mocked(api.createFolder).mockResolvedValue({
      folder: {
        id: 'f-new',
        encryptedName: { ciphertext: 'c', nonce: 'n' },
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
      },
    } as never);

    const { wrapper, queryClient } = makeWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useCreateFolder(), { wrapper });
    result.current.mutate('Work');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(encryptFolderName).toHaveBeenCalledWith('Work', expect.any(Uint8Array));
    expect(api.createFolder).toHaveBeenCalledWith('v1', expect.any(Object));
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: FOLDERS_KEY });
    expect(result.current.data?.name).toBe('Work');
    expect(result.current.data?.id).toBe('f-new');
  });
});

describe('useRenameFolder', () => {
  it('encrypts the new name, calls api.updateFolder, and invalidates folders query', async () => {
    mockSession();
    const fakeEncrypted = { ciphertext: new Uint8Array(1), nonce: new Uint8Array(24) };
    vi.mocked(encryptFolderName).mockResolvedValue(fakeEncrypted);
    vi.mocked(api.updateFolder).mockResolvedValue({
      folder: {
        id: 'f1',
        encryptedName: { ciphertext: 'c', nonce: 'n' },
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
      },
    } as never);

    const { wrapper, queryClient } = makeWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useRenameFolder(), { wrapper });
    result.current.mutate({ folderId: 'f1', name: 'Personal' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(encryptFolderName).toHaveBeenCalledWith('Personal', expect.any(Uint8Array));
    expect(api.updateFolder).toHaveBeenCalledWith('v1', 'f1', expect.any(Object));
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: FOLDERS_KEY });
  });
});

describe('useDeleteFolder', () => {
  it('calls api.deleteFolder and invalidates folders query', async () => {
    mockSession();
    vi.mocked(api.deleteFolder).mockResolvedValue(undefined);

    const { wrapper, queryClient } = makeWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useDeleteFolder(), { wrapper });
    result.current.mutate('f1');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.deleteFolder).toHaveBeenCalledWith('v1', 'f1');
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: FOLDERS_KEY });
  });
});
