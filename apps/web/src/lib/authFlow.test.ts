import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { authFlow } from './authFlow';
import type { Keychain } from '@blindpass/crypto';

function makeKeychain(): Keychain {
  return { masterKey: new Uint8Array(32), vaultKey: new Uint8Array(32) };
}

beforeEach(() => {
  authFlow.clearRegister();
  authFlow.clearLogin();
  authFlow.clearPendingSession();
  authFlow.clearRecoveryKey();
  authFlow.clearRecovery();
  vi.clearAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('register flow', () => {
  it('stores register state', () => {
    const state = {
      username: 'user_test',
      enrollment: {
        enrollmentId: '550e8400-e29b-41d4-a716-446655440000',
        setupKey: 'ABCDEF123456',
        otpauthUri: 'https://example.com/otp',
        expiresAt: new Date().toISOString(),
      },
      keychain: makeKeychain(),
      recoveryKey: 'word word word',
    };
    authFlow.setRegister(state);
    expect(authFlow.getRegister()).toBe(state);
  });

  it('clears register and recovery key state', () => {
    authFlow.setRegister({
      username: 'user_test',
      enrollment: {
        enrollmentId: '550e8400-e29b-41d4-a716-446655440000',
        setupKey: 'ABCDEF123456',
        otpauthUri: 'https://example.com/otp',
        expiresAt: new Date().toISOString(),
      },
      keychain: makeKeychain(),
      recoveryKey: 'word word word',
    });
    authFlow.setRecoveryKey('word word word');
    authFlow.clearRegister();
    authFlow.clearRecoveryKey();
    expect(authFlow.getRegister()).toBeNull();
    expect(authFlow.getRecoveryKey()).toBeNull();
  });
});

describe('login flow', () => {
  it('stores username and password', () => {
    authFlow.setLogin({ username: 'user_test', password: 'pass' });
    expect(authFlow.getLogin()).toEqual({ username: 'user_test', password: 'pass' });
  });

  it('login auto-clears after 60s', () => {
    vi.useFakeTimers();
    authFlow.setLogin({ username: 'user_test', password: 'pass' });
    vi.advanceTimersByTime(60_001);
    expect(authFlow.getLogin()).toBeNull();
  });

  it('replacing login state clears the previous timer', () => {
    vi.useFakeTimers();
    authFlow.setLogin({ username: 'user_a', password: 'one' });
    vi.advanceTimersByTime(30_000);
    authFlow.setLogin({ username: 'user_b', password: 'two' });
    vi.advanceTimersByTime(30_500);
    expect(authFlow.getLogin()).toEqual({ username: 'user_b', password: 'two' });
    vi.advanceTimersByTime(30_000);
    expect(authFlow.getLogin()).toBeNull();
  });

  it('clearLogin removes state immediately', () => {
    authFlow.setLogin({ username: 'user_test', password: 'pass' });
    authFlow.clearLogin();
    expect(authFlow.getLogin()).toBeNull();
  });
});

describe('recovery flow', () => {
  const bundle = {
    publicKey: 'pk',
    kekSalt: 'salt',
    encryptedMasterKey: { ciphertext: '', nonce: '' },
    encryptedMasterKeyForRecovery: { ciphertext: '', nonce: '' },
    encryptedPrivateKey: { ciphertext: '', nonce: '' },
    encryptedRecoveryKey: { ciphertext: '', nonce: '' },
  };

  it('stores recovery state', () => {
    const state = {
      username: 'user_test',
      recoveryToken: 'token',
      enrollment: {
        enrollmentId: '550e8400-e29b-41d4-a716-446655440000',
        setupKey: 'ABCDEF123456',
        otpauthUri: 'https://example.com/otp',
        expiresAt: new Date().toISOString(),
      },
      bundle,
    };
    authFlow.setRecovery(state);
    expect(authFlow.getRecovery()).toBe(state);
  });

  it('stores and clears pending session state', () => {
    const pending = {
      username: 'user_test',
      activeVaultId: 'vault-1',
      vaults: new Map(),
      keychain: null,
      keyPair: null,
    };
    authFlow.setPendingSession(pending);
    expect(authFlow.getPendingSession()).toBe(pending);
    authFlow.clearPendingSession();
    expect(authFlow.getPendingSession()).toBeNull();
  });

  it('clears recovery state', () => {
    authFlow.setRecovery({
      username: 'user_test',
      recoveryToken: 'token',
      enrollment: {
        enrollmentId: '550e8400-e29b-41d4-a716-446655440000',
        setupKey: 'ABCDEF123456',
        otpauthUri: 'https://example.com/otp',
        expiresAt: new Date().toISOString(),
      },
      bundle,
    });
    authFlow.clearRecovery();
    expect(authFlow.getRecovery()).toBeNull();
  });
});
