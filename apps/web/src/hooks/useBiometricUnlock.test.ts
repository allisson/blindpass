import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { IDBFactory } from 'fake-indexeddb';

const { sessionMock } = vi.hoisted(() => ({
  sessionMock: { get: vi.fn(), set: vi.fn() },
}));
vi.mock('@/lib/session', () => ({
  session: sessionMock,
  getLastUsername: () => 'tester',
}));

import { useBiometricUnlock } from './useBiometricUnlock';
import { enrollmentStore, ENROLLMENT_VERSION } from '@/lib/biometric';
import { ApiError } from '@/lib/api';

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

function makeDeps(opts?: { fail?: 'unlock' | 'cancel' | 'invalidState' | 'noVault' | 'revoked' }) {
  const masterKey = new Uint8Array([1, 2, 3]);
  const privateKey = new Uint8Array([4, 5, 6]);
  const vaultKey = new Uint8Array([7, 8, 9]);
  const buildVaultsMap = vi
    .fn()
    .mockResolvedValue(
      new Map([['v1', { vaultKey, name: 'Personal', isShared: false, role: 'owner' }]]),
    );
  const cancelErr = (() => {
    const e = new Error('user cancelled');
    e.name = 'NotAllowedError';
    return e;
  })();
  const invalidStateErr = (() => {
    const e = new Error('credential gone');
    e.name = 'InvalidStateError';
    return e;
  })();
  return {
    masterKey,
    privateKey,
    vaultKey,
    deps: {
      api: {
        getKeys: vi.fn().mockResolvedValue(KEYS_RESPONSE),
        getVault: vi.fn().mockResolvedValue({
          vaults: opts?.fail === 'noVault' ? [] : [VAULT_OWNED],
          nextCursor: null,
        }),
        getBiometricCredential: vi.fn(
          opts?.fail === 'revoked'
            ? () => Promise.reject(new ApiError(404, 'Not found'))
            : () => Promise.resolve({} as never),
        ),
      },
      primitives: {
        unlockWithBiometric: vi.fn(
          opts?.fail === 'unlock'
            ? () => Promise.reject(new Error('PRF assertion produced no output'))
            : opts?.fail === 'cancel'
              ? () => Promise.reject(cancelErr)
              : opts?.fail === 'invalidState'
                ? () => Promise.reject(invalidStateErr)
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
  vi.stubGlobal('indexedDB', new IDBFactory());
  sessionMock.get.mockReturnValue({ username: 'tester' });
  sessionMock.set.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

async function seedEnrollment() {
  await enrollmentStore.put({
    version: ENROLLMENT_VERSION,
    username: 'tester',
    credentialId: new Uint8Array([1]),
    prfSalt: new Uint8Array([2]),
    encryptedMasterKey: { ciphertext: new Uint8Array([3]), nonce: new Uint8Array([4]) },
    rpId: 'localhost',
    createdAt: 'now',
  });
}

async function seedEnrollmentWithServerCredential() {
  await enrollmentStore.put({
    version: ENROLLMENT_VERSION,
    username: 'tester',
    credentialId: new Uint8Array([1]),
    prfSalt: new Uint8Array([2]),
    encryptedMasterKey: { ciphertext: new Uint8Array([3]), nonce: new Uint8Array([4]) },
    rpId: 'localhost',
    createdAt: 'now',
    serverCredentialId: 'server-cred-uuid',
  });
}

describe('useBiometricUnlock', () => {
  it('happy path: unlocks vault and writes session', async () => {
    await seedEnrollment();
    const { deps } = makeDeps();
    const { result } = renderHook(() => useBiometricUnlock(deps));
    let res!: Awaited<ReturnType<typeof result.current.unlock>>;
    await act(async () => {
      res = await result.current.unlock();
    });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.value.activeVaultId).toBe('v1');
    expect(sessionMock.set).toHaveBeenCalledOnce();
  });

  it('returns biometric_failed when unlock primitive throws PRF/biometric error', async () => {
    await seedEnrollment();
    const { deps } = makeDeps({ fail: 'unlock' });
    const { result } = renderHook(() => useBiometricUnlock(deps));
    let res!: Awaited<ReturnType<typeof result.current.unlock>>;
    await act(async () => {
      res = await result.current.unlock();
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('biometric_failed');
  });

  it('returns biometric_cancelled when user cancels', async () => {
    await seedEnrollment();
    const { deps } = makeDeps({ fail: 'cancel' });
    const { result } = renderHook(() => useBiometricUnlock(deps));
    let res!: Awaited<ReturnType<typeof result.current.unlock>>;
    await act(async () => {
      res = await result.current.unlock();
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('biometric_cancelled');
  });

  it('returns biometric_failed on InvalidStateError (credential gone)', async () => {
    await seedEnrollment();
    const { deps } = makeDeps({ fail: 'invalidState' });
    const { result } = renderHook(() => useBiometricUnlock(deps));
    let res!: Awaited<ReturnType<typeof result.current.unlock>>;
    await act(async () => {
      res = await result.current.unlock();
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('biometric_failed');
  });

  it('errors out when no enrollment exists for the username', async () => {
    const { deps } = makeDeps();
    const { result } = renderHook(() => useBiometricUnlock(deps));
    let res!: Awaited<ReturnType<typeof result.current.unlock>>;
    await act(async () => {
      res = await result.current.unlock();
    });
    expect(res.ok).toBe(false);
    // "No biometric enrollment …" maps to biometric_failed via the error
    // message-based classifier in ceremony.ts
    if (!res.ok) expect(res.error.code).toBe('biometric_failed');
  });

  it('returns no_vault when owned vault is missing', async () => {
    await seedEnrollment();
    const { deps } = makeDeps({ fail: 'noVault' });
    const { result } = renderHook(() => useBiometricUnlock(deps));
    let res!: Awaited<ReturnType<typeof result.current.unlock>>;
    await act(async () => {
      res = await result.current.unlock();
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('no_vault');
  });

  it('returns credential_revoked and wipes enrollment when server returns 404', async () => {
    await seedEnrollmentWithServerCredential();
    const { deps } = makeDeps({ fail: 'revoked' });
    const { result } = renderHook(() => useBiometricUnlock(deps));
    let res!: Awaited<ReturnType<typeof result.current.unlock>>;
    await act(async () => {
      res = await result.current.unlock();
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('credential_revoked');
    const remaining = await enrollmentStore.get('tester');
    expect(remaining).toBeNull();
  });

  it('reset clears phase and error', async () => {
    await seedEnrollment();
    const { deps } = makeDeps({ fail: 'unlock' });
    const { result } = renderHook(() => useBiometricUnlock(deps));
    await act(async () => {
      await result.current.unlock();
    });
    expect(result.current.phase).toBe('error');
    act(() => result.current.reset());
    expect(result.current.phase).toBe('idle');
    expect(result.current.error).toBeNull();
  });
});
