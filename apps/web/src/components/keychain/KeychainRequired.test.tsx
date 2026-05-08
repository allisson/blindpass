import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';

const { sessionMock, navigateMock } = vi.hoisted(() => ({
  sessionMock: { get: vi.fn() },
  navigateMock: vi.fn(),
}));

vi.mock('@/lib/session', () => ({ session: sessionMock }));
vi.mock('@tanstack/react-router', () => ({
  Navigate: (props: { to: string }) => {
    navigateMock(props.to);
    return null;
  },
}));

vi.mock('@blindpass/vault', () => ({
  decryptVaultItem: vi.fn(async () => ({ type: 'login', title: 'X' })),
  encryptVaultItem: vi.fn(async () => ({ ciphertext: new Uint8Array(), nonce: new Uint8Array() })),
}));

vi.mock('@blindpass/crypto', () => ({
  decryptSymmetric: vi.fn(async () => new Uint8Array(32)),
  encryptSymmetric: vi.fn(async () => ({
    ciphertext: new Uint8Array(),
    nonce: new Uint8Array(),
  })),
  generateKey: vi.fn(async () => new Uint8Array(32)),
}));

vi.mock('@/lib/b64', () => ({
  fromBase64EncryptedValue: vi.fn((v: unknown) => v),
  toBase64EncryptedValue: vi.fn(() => ({ ciphertext: 'c', nonce: 'n' })),
}));

import { KeychainRequired, useKeychain } from './KeychainRequired';

function wrap(children: ReactNode) {
  return createElement(KeychainRequired, null, children);
}

beforeEach(() => {
  navigateMock.mockReset();
});

afterEach(() => vi.clearAllMocks());

describe('KeychainRequired', () => {
  it('renders children when keychain hot', () => {
    sessionMock.get.mockReturnValue({
      activeVaultId: 'v1',
      vaults: new Map([['v1', { vaultKey: new Uint8Array([2]), name: 'P', isShared: false }]]),
      keychain: { masterKey: new Uint8Array([1]), vaultKey: new Uint8Array([2]) },
      keyPair: { publicKey: new Uint8Array(), privateKey: new Uint8Array() },
      username: 'alice',
    });
    const { result } = renderHook(() => useKeychain(), {
      wrapper: ({ children }) => wrap(children) as React.ReactElement,
    });
    expect(result.current.activeVaultId).toBe('v1');
    expect(result.current.username).toBe('alice');
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it('redirects to /unlock when keychain null', () => {
    sessionMock.get.mockReturnValue({
      activeVaultId: 'v1',
      vaults: new Map(),
      keychain: null,
      keyPair: null,
    });
    renderHook(() => useKeychain(), {
      wrapper: ({ children }) => wrap(children) as React.ReactElement,
    });
    expect(navigateMock).toHaveBeenCalledWith('/unlock');
  });

  it('decryptItem composes envelope through primitives', async () => {
    sessionMock.get.mockReturnValue({
      activeVaultId: 'v1',
      vaults: new Map([['v1', { vaultKey: new Uint8Array([2]), name: 'P', isShared: false }]]),
      keychain: { masterKey: new Uint8Array([1]), vaultKey: new Uint8Array([2]) },
      keyPair: { publicKey: new Uint8Array(), privateKey: new Uint8Array() },
    });
    const { result } = renderHook(() => useKeychain(), {
      wrapper: ({ children }) => wrap(children) as React.ReactElement,
    });
    const out = await result.current.decryptItem({
      id: 'item1',
      folderId: null,
      createdAt: '2024-01-01',
      updatedAt: '2024-01-02',
      encryptedData: { ciphertext: 'c', nonce: 'n' },
      encryptedItemKey: { ciphertext: 'c', nonce: 'n' },
    } as never);
    expect(out.id).toBe('item1');
    expect(out.title).toBe('X');
  });

  it('getVaultKey throws on unknown vault id', () => {
    sessionMock.get.mockReturnValue({
      activeVaultId: 'v1',
      vaults: new Map([['v1', { vaultKey: new Uint8Array([2]), name: 'P', isShared: false }]]),
      keychain: { masterKey: new Uint8Array([1]), vaultKey: new Uint8Array([2]) },
      keyPair: { publicKey: new Uint8Array(), privateKey: new Uint8Array() },
    });
    const { result } = renderHook(() => useKeychain(), {
      wrapper: ({ children }) => wrap(children) as React.ReactElement,
    });
    expect(() => result.current.getVaultKey('unknown')).toThrow(/not in keychain/i);
  });

  it('getVaultKey returns key for known vault', () => {
    const vaultKey = new Uint8Array([42]);
    sessionMock.get.mockReturnValue({
      activeVaultId: 'v1',
      vaults: new Map([['v1', { vaultKey, name: 'P', isShared: false }]]),
      keychain: { masterKey: new Uint8Array([1]), vaultKey },
      keyPair: { publicKey: new Uint8Array(), privateKey: new Uint8Array() },
    });
    const { result } = renderHook(() => useKeychain(), {
      wrapper: ({ children }) => wrap(children) as React.ReactElement,
    });
    expect(result.current.getVaultKey('v1')).toBe(vaultKey);
  });

  it('encryptItem encrypts payload with vault key', async () => {
    sessionMock.get.mockReturnValue({
      activeVaultId: 'v1',
      vaults: new Map([['v1', { vaultKey: new Uint8Array([2]), name: 'P', isShared: false }]]),
      keychain: { masterKey: new Uint8Array([1]), vaultKey: new Uint8Array([2]) },
      keyPair: { publicKey: new Uint8Array(), privateKey: new Uint8Array() },
    });
    const { result } = renderHook(() => useKeychain(), {
      wrapper: ({ children }) => wrap(children) as React.ReactElement,
    });
    const out = await result.current.encryptItem({ type: 'login', title: 'Test' } as never);
    expect(out.encryptedData).toEqual({ ciphertext: 'c', nonce: 'n' });
    expect(out.encryptedItemKey).toEqual({ ciphertext: 'c', nonce: 'n' });
  });

  it('useKeychain throws when called outside KeychainRequired provider', () => {
    expect(() => renderHook(() => useKeychain())).toThrow(
      'useKeychain must be called inside <KeychainRequired>',
    );
  });

  it('refreshes snapshot on bp:keychain-change event', async () => {
    sessionMock.get.mockReturnValue({
      activeVaultId: 'v1',
      vaults: new Map([['v1', { vaultKey: new Uint8Array([2]), name: 'P', isShared: false }]]),
      keychain: { masterKey: new Uint8Array([1]), vaultKey: new Uint8Array([2]) },
      keyPair: { publicKey: new Uint8Array(), privateKey: new Uint8Array() },
      username: 'alice',
    });
    const { result } = renderHook(() => useKeychain(), {
      wrapper: ({ children }) => wrap(children) as React.ReactElement,
    });
    expect(result.current.username).toBe('alice');

    sessionMock.get.mockReturnValue({
      activeVaultId: 'v1',
      vaults: new Map([['v1', { vaultKey: new Uint8Array([2]), name: 'P', isShared: false }]]),
      keychain: { masterKey: new Uint8Array([1]), vaultKey: new Uint8Array([2]) },
      keyPair: { publicKey: new Uint8Array(), privateKey: new Uint8Array() },
      username: 'bob',
    });
    await act(async () => {
      window.dispatchEvent(new Event('bp:keychain-change'));
    });
    await waitFor(() => expect(result.current.username).toBe('bob'));
  });
});
