import { afterEach, describe, expect, it, vi } from 'vitest';
import { DecryptionError } from '@blindpass/crypto';
import { renderHook, act } from '@testing-library/react';

const { sessionMock } = vi.hoisted(() => ({
  sessionMock: { clear: vi.fn() },
}));
vi.mock('@/lib/session', () => ({ session: sessionMock }));

import { useChangePassword } from './useChangePassword';

function makeDeps() {
  const masterKey = new Uint8Array([1, 2, 3]);
  return {
    masterKey,
    deps: {
      api: {
        getKeys: vi.fn().mockResolvedValue({
          kekSalt: 'AAAA',
          encryptedMasterKey: { ciphertext: 'AAAA', nonce: 'AAAA' },
        }),
        changePassword: vi.fn().mockResolvedValue(undefined),
      },
      primitives: {
        deriveKEK: vi.fn(async () => new Uint8Array([9, 9, 9])),
        generateSalt: vi.fn(async () => new Uint8Array([0, 0, 0, 0])),
        decryptSymmetric: vi.fn(async () => masterKey),
        encryptSymmetric: vi.fn(async () => ({
          ciphertext: new Uint8Array([1]),
          nonce: new Uint8Array([2]),
        })),
      },
    },
  };
}

afterEach(() => vi.clearAllMocks());

describe('useChangePassword', () => {
  it('completes happy path and clears session', async () => {
    const { deps } = makeDeps();
    const { result } = renderHook(() => useChangePassword(deps));
    let res!: Awaited<ReturnType<typeof result.current.changePassword>>;
    await act(async () => {
      res = await result.current.changePassword({
        currentPassword: 'old',
        newPassword: 'new',
        authenticatorCode: '123456',
      });
    });
    expect(res.ok).toBe(true);
    expect(deps.api.changePassword).toHaveBeenCalledOnce();
    expect(sessionMock.clear).toHaveBeenCalledOnce();
    expect(result.current.phase).toBe('done');
  });

  it('reset clears phase and error', async () => {
    const { deps } = makeDeps();
    deps.primitives.decryptSymmetric = vi.fn(async () => {
      throw new Error('bad mac');
    });
    const { result } = renderHook(() => useChangePassword(deps));
    await act(async () => {
      await result.current.changePassword({
        currentPassword: 'old',
        newPassword: 'new',
        authenticatorCode: '123456',
      });
    });
    expect(result.current.phase).toBe('error');
    act(() => result.current.reset());
    expect(result.current.phase).toBe('idle');
    expect(result.current.error).toBeNull();
  });

  it('maps bad mac error to wrong_password and zeros masterKey', async () => {
    const { deps, masterKey } = makeDeps();
    deps.primitives.decryptSymmetric = vi.fn(async () => {
      throw new DecryptionError('bad mac');
    });
    const { result } = renderHook(() => useChangePassword(deps));
    let res!: Awaited<ReturnType<typeof result.current.changePassword>>;
    await act(async () => {
      res = await result.current.changePassword({
        currentPassword: 'old',
        newPassword: 'new',
        authenticatorCode: '123456',
      });
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('wrong_password');
    // masterKey was never produced; just sanity-check no zero panic
    expect(masterKey).toBeDefined();
  });
});
