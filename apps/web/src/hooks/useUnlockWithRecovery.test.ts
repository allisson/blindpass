import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DecryptionError } from '@blindpass/crypto';
import { renderHook, act } from '@testing-library/react';

const { sessionMock, authFlowMock } = vi.hoisted(() => ({
  sessionMock: { get: vi.fn(), set: vi.fn() },
  authFlowMock: {
    getRecovery: vi.fn(),
    getRecoveryKey: vi.fn(),
    clearRecovery: vi.fn(),
    setRecoveryKey: vi.fn(),
    setPendingSession: vi.fn(),
  },
}));

vi.mock('@/lib/session', () => ({ session: sessionMock }));
vi.mock('@/lib/authFlow', () => ({ authFlow: authFlowMock }));

import { useUnlockWithRecovery } from './useUnlockWithRecovery';

const RECOVERY = {
  username: 'alice',
  recoveryToken: 'tok',
  enrollment: { enrollmentId: 'enr', otpauthUri: 'otpauth://x', setupKey: 'k' },
  bundle: {
    publicKey: 'pk',
    encryptedMasterKeyForRecovery: { ciphertext: 'c', nonce: 'n' },
    encryptedPrivateKey: { ciphertext: 'c', nonce: 'n' },
  },
};

const VAULT = {
  id: 'v1',
  isShared: false,
  encryptedVaultData: { ciphertext: 'c', nonce: 'n' },
  encryptedVaultKey: { ciphertext: 'c', nonce: 'n' },
};

function makeDeps() {
  const masterKey = new Uint8Array([1]);
  const privateKey = new Uint8Array([2]);
  const vaultKey = new Uint8Array([3]);
  return {
    masterKey,
    privateKey,
    vaultKey,
    deps: {
      api: {
        completeRecovery: vi.fn().mockResolvedValue(undefined),
        getVault: vi.fn().mockResolvedValue({ vaults: [VAULT], nextCursor: null }),
      },
      primitives: {
        unlockWithRecovery: vi.fn().mockResolvedValue({
          masterKey,
          keyPair: { publicKey: new Uint8Array(), privateKey },
        }),
        rekey: vi.fn().mockResolvedValue({
          newRecoveryKey: 'new-phrase',
          kekSalt: 'salt',
          encryptedMasterKey: { ciphertext: 'c', nonce: 'n' },
          encryptedMasterKeyForRecovery: { ciphertext: 'c', nonce: 'n' },
          encryptedRecoveryKey: { ciphertext: 'c', nonce: 'n' },
          recoveryVerifier: 'verifier',
        }),
        buildVaultsMap: vi
          .fn()
          .mockResolvedValue(
            new Map([['v1', { vaultKey, name: 'P', isShared: false, role: 'owner' }]]),
          ),
      },
    },
  };
}

beforeEach(() => {
  authFlowMock.getRecovery.mockReturnValue(RECOVERY);
  authFlowMock.getRecoveryKey.mockReturnValue('phrase');
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('useUnlockWithRecovery', () => {
  it('completes happy path', async () => {
    const { deps } = makeDeps();
    const { result } = renderHook(() => useUnlockWithRecovery(deps));
    let res!: Awaited<ReturnType<typeof result.current.completeRecovery>>;
    await act(async () => {
      res = await result.current.completeRecovery({
        newPassword: 'newpw',
        authenticatorCode: '123456',
      });
    });
    expect(res.ok).toBe(true);
    expect(deps.api.completeRecovery).toHaveBeenCalledOnce();
    expect(authFlowMock.setRecoveryKey).toHaveBeenCalledWith('new-phrase');
    expect(authFlowMock.setPendingSession).toHaveBeenCalledOnce();
    expect(sessionMock.set).toHaveBeenCalledWith(expect.objectContaining({ keychain: null }));
    expect(result.current.phase).toBe('done');
  });

  it('returns wrong_password on bad recovery phrase', async () => {
    const { deps } = makeDeps();
    deps.primitives.unlockWithRecovery = vi.fn(async () => {
      throw new DecryptionError('bad mac');
    });
    const { result } = renderHook(() => useUnlockWithRecovery(deps));
    let res!: Awaited<ReturnType<typeof result.current.completeRecovery>>;
    await act(async () => {
      res = await result.current.completeRecovery({
        newPassword: 'newpw',
        authenticatorCode: '123456',
      });
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('wrong_password');
  });

  it('throws no_vault when no owned vault returned', async () => {
    const { deps } = makeDeps();
    deps.api.getVault = vi.fn().mockResolvedValue({ vaults: [], nextCursor: null });
    const { result } = renderHook(() => useUnlockWithRecovery(deps));
    let res!: Awaited<ReturnType<typeof result.current.completeRecovery>>;
    await act(async () => {
      res = await result.current.completeRecovery({
        newPassword: 'newpw',
        authenticatorCode: '123456',
      });
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('no_vault');
  });

  it('throws when active vault missing from map', async () => {
    const { deps } = makeDeps();
    deps.primitives.buildVaultsMap = vi.fn(async () => new Map());
    const { result } = renderHook(() => useUnlockWithRecovery(deps));
    let res!: Awaited<ReturnType<typeof result.current.completeRecovery>>;
    await act(async () => {
      res = await result.current.completeRecovery({
        newPassword: 'newpw',
        authenticatorCode: '123456',
      });
    });
    expect(res.ok).toBe(false);
  });

  it('reset clears phase and error', async () => {
    const { deps } = makeDeps();
    deps.primitives.unlockWithRecovery = vi.fn(async () => {
      throw new Error('bad mac');
    });
    const { result } = renderHook(() => useUnlockWithRecovery(deps));
    await act(async () => {
      await result.current.completeRecovery({
        newPassword: 'newpw',
        authenticatorCode: '123456',
      });
    });
    expect(result.current.phase).toBe('error');
    act(() => result.current.reset());
    expect(result.current.phase).toBe('idle');
    expect(result.current.error).toBeNull();
  });

  it('aborts when recovery context missing', async () => {
    authFlowMock.getRecovery.mockReturnValue(null);
    authFlowMock.getRecoveryKey.mockReturnValue(null);
    const { deps } = makeDeps();
    const { result } = renderHook(() => useUnlockWithRecovery(deps));
    let res!: Awaited<ReturnType<typeof result.current.completeRecovery>>;
    await act(async () => {
      res = await result.current.completeRecovery({
        newPassword: 'newpw',
        authenticatorCode: '123456',
      });
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('unknown');
  });
});
