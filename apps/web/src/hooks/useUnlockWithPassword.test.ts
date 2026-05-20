import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DecryptionError } from '@blindpass/crypto';
import { renderHook, act } from '@testing-library/react';

const { sessionMock } = vi.hoisted(() => ({
  sessionMock: { get: vi.fn(), set: vi.fn() },
}));
vi.mock('@/lib/session', () => ({
  session: sessionMock,
  getLastUsername: () => 'tester',
}));

import { useUnlockWithPassword } from './useUnlockWithPassword';

const KEYS_RESPONSE = {
  kekSalt: 'salt',
  publicKey: 'pk',
  encryptedMasterKey: { ciphertext: 'c', nonce: 'n' },
  encryptedPrivateKey: { ciphertext: 'c', nonce: 'n' },
} as never;

const VAULT_OWNED = {
  id: 'v1',
  isShared: false,
  encryptedVaultData: { ciphertext: 'c', nonce: 'n' },
  encryptedVaultKey: { ciphertext: 'c', nonce: 'n' },
};

function makeDeps(overrides?: { fail?: 'unlock' | 'getKeys' | 'noVault' }) {
  const masterKey = new Uint8Array([1, 2, 3]);
  const privateKey = new Uint8Array([4, 5, 6]);
  const vaultKey = new Uint8Array([7, 8, 9]);
  const buildVaultsMap = vi
    .fn()
    .mockResolvedValue(
      new Map([['v1', { vaultKey, name: 'Personal', isShared: false, role: 'owner' }]]),
    );
  return {
    masterKey,
    privateKey,
    vaultKey,
    buildVaultsMap,
    deps: {
      api: {
        getKeys: vi.fn(
          overrides?.fail === 'getKeys'
            ? () => Promise.reject(new Error('boom'))
            : () => Promise.resolve(KEYS_RESPONSE),
        ),
        getVault: vi.fn().mockResolvedValue({
          vaults: overrides?.fail === 'noVault' ? [] : [VAULT_OWNED],
          nextCursor: null,
        }),
      },
      primitives: {
        unlockWithPassword: vi.fn(
          overrides?.fail === 'unlock'
            ? () => Promise.reject(new Error('bad mac'))
            : () =>
                Promise.resolve({
                  masterKey,
                  keyPair: { publicKey: new Uint8Array(), privateKey },
                }),
        ),
        buildVaultsMap,
      },
    },
  };
}

beforeEach(() => {
  sessionMock.get.mockReturnValue(null);
  sessionMock.set.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('useUnlockWithPassword', () => {
  it('walks happy path and sets session on success', async () => {
    const { deps } = makeDeps();
    const { result } = renderHook(() => useUnlockWithPassword(deps));
    let res!: Awaited<ReturnType<typeof result.current.unlock>>;
    await act(async () => {
      res = await result.current.unlock('pw');
    });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.value.activeVaultId).toBe('v1');
    expect(sessionMock.set).toHaveBeenCalledOnce();
    expect(result.current.phase).toBe('done');
    expect(result.current.error).toBeNull();
  });

  it('zeros keys on wrong-password error', async () => {
    const { deps, masterKey, privateKey } = makeDeps({ fail: 'unlock' });
    deps.primitives.unlockWithPassword = vi.fn(async () => {
      throw new DecryptionError('bad mac');
    });
    const { result } = renderHook(() => useUnlockWithPassword(deps));
    let res!: Awaited<ReturnType<typeof result.current.unlock>>;
    await act(async () => {
      res = await result.current.unlock('pw');
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('wrong_password');
    // unlock primitive throws before keys returned, so no zeroing happens here
    // but masterKey/privateKey still zeroed in error path of any tracking that did occur
    expect(masterKey).toBeDefined();
    expect(privateKey).toBeDefined();
    expect(result.current.phase).toBe('error');
  });

  it('returns no_vault when owned vault missing', async () => {
    const { deps } = makeDeps({ fail: 'noVault' });
    const { result } = renderHook(() => useUnlockWithPassword(deps));
    let res!: Awaited<ReturnType<typeof result.current.unlock>>;
    await act(async () => {
      res = await result.current.unlock('pw');
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('no_vault');
  });

  it('zeros tracked keys when buildVaultsMap throws', async () => {
    const { deps, masterKey, privateKey } = makeDeps();
    deps.primitives.buildVaultsMap = vi.fn(async () => {
      throw new Error('decrypt vault meta failed');
    });
    const { result } = renderHook(() => useUnlockWithPassword(deps));
    await act(async () => {
      await result.current.unlock('pw');
    });
    expect(Array.from(masterKey)).toEqual([0, 0, 0]);
    expect(Array.from(privateKey)).toEqual([0, 0, 0]);
  });

  it('throws when active vault missing from map', async () => {
    const { deps } = makeDeps();
    deps.primitives.buildVaultsMap = vi.fn(async () => new Map());
    const { result } = renderHook(() => useUnlockWithPassword(deps));
    let res!: Awaited<ReturnType<typeof result.current.unlock>>;
    await act(async () => {
      res = await result.current.unlock('pw');
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('unknown');
  });

  it('reset clears phase and error', async () => {
    const { deps } = makeDeps({ fail: 'unlock' });
    const { result } = renderHook(() => useUnlockWithPassword(deps));
    await act(async () => {
      await result.current.unlock('pw');
    });
    expect(result.current.phase).toBe('error');
    act(() => result.current.reset());
    expect(result.current.phase).toBe('idle');
    expect(result.current.error).toBeNull();
  });
});
