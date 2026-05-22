import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  session,
  getLastUsername,
  setLastUsername,
  clearLastUsername,
  type Session,
} from './session';
import type { Keychain } from '@blindpass/crypto';

vi.mock('@blindpass/vault', () => ({
  lock: vi.fn(),
}));

function makeKeychain(): Keychain {
  return {
    masterKey: new Uint8Array([1, 2, 3]),
    vaultKey: new Uint8Array([4, 5, 6]),
  };
}

function makeSession(): Session {
  return {
    username: 'user_test',
    activeVaultId: 'v1',
    vaults: new Map([
      ['v1', { vaultKey: new Uint8Array([7, 8, 9]), name: 'Main', isShared: false }],
    ]),
    keychain: makeKeychain(),
    keyPair: null,
  };
}

describe('lastUsername helpers', () => {
  beforeEach(() => localStorage.clear());

  it('returns null when not set', () => {
    expect(getLastUsername()).toBeNull();
  });

  it('round-trips a value', () => {
    setLastUsername('user_test');
    expect(getLastUsername()).toBe('user_test');
  });

  it('clearLastUsername removes the item', () => {
    setLastUsername('user_test');
    clearLastUsername();
    expect(getLastUsername()).toBeNull();
  });
});

describe('session', () => {
  beforeEach(() => {
    session.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    session.clearIdleTimer();
  });

  it('set and get round-trip', () => {
    const s = makeSession();
    session.set(s);
    expect(session.get()).toBe(s);
  });

  it('clear zeros vault keys', () => {
    const s = makeSession();
    const vaultKey = s.vaults.get('v1')!.vaultKey as Uint8Array;
    session.set(s);
    session.clear();
    expect(vaultKey.every((b) => b === 0)).toBe(true);
  });

  it('lock calls zeroKeys and nulls keychain', async () => {
    const { lock } = await import('@blindpass/vault');
    const s = makeSession();
    const keychain = s.keychain;
    session.set(s);
    session.lock();
    expect(lock).toHaveBeenCalledWith(keychain);
    expect(session.get()?.keychain).toBeNull();
  });

  it('lock clears recently viewed history for every vault', () => {
    const s = makeSession();
    s.vaults.set('v2', { vaultKey: new Uint8Array([1]), name: 'Work', isShared: false });
    localStorage.setItem('bp:recent:v1', JSON.stringify(['a', 'b']));
    localStorage.setItem('bp:recent:v2', JSON.stringify(['c']));
    session.set(s);
    session.lock();
    expect(localStorage.getItem('bp:recent:v1')).toBeNull();
    expect(localStorage.getItem('bp:recent:v2')).toBeNull();
  });

  it('clear removes recently viewed history for every vault', () => {
    const s = makeSession();
    s.vaults.set('v2', { vaultKey: new Uint8Array([1]), name: 'Work', isShared: false });
    localStorage.setItem('bp:recent:v1', JSON.stringify(['a']));
    localStorage.setItem('bp:recent:v2', JSON.stringify(['b']));
    session.set(s);
    session.clear();
    expect(localStorage.getItem('bp:recent:v1')).toBeNull();
    expect(localStorage.getItem('bp:recent:v2')).toBeNull();
  });

  it('switchVault updates activeVaultId and vaultKey', () => {
    const s = makeSession();
    const vaultKey2 = new Uint8Array([20, 21, 22]);
    s.vaults.set('v2', { vaultKey: vaultKey2, name: 'Work', isShared: false });
    session.set(s);
    session.switchVault('v2');
    expect(session.get()?.activeVaultId).toBe('v2');
    expect(session.get()?.keychain?.vaultKey).toBe(vaultKey2);
  });

  it('switchVault ignores missing session, missing vault, and locked session', () => {
    session.switchVault('missing');
    expect(session.get()).toBeNull();

    const s = makeSession();
    session.set(s);
    session.switchVault('missing');
    expect(session.get()?.activeVaultId).toBe('v1');

    s.keychain = null;
    session.switchVault('v1');
    expect(session.get()?.activeVaultId).toBe('v1');
  });

  it('idle timer expiry and reset honor configured minutes', () => {
    vi.useFakeTimers();
    const onExpiry = vi.fn();
    session.startIdleTimer(onExpiry, 1);
    vi.advanceTimersByTime(59_000);
    expect(onExpiry).not.toHaveBeenCalled();
    session.resetIdleTimer();
    vi.advanceTimersByTime(59_000);
    expect(onExpiry).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1_001);
    expect(onExpiry).toHaveBeenCalledTimes(1);
  });

  it('clearIdleTimer and zero idle minutes stop scheduling', () => {
    vi.useFakeTimers();
    const onExpiry = vi.fn();
    session.startIdleTimer(onExpiry, 1);
    session.clearIdleTimer();
    vi.advanceTimersByTime(61_000);
    expect(onExpiry).not.toHaveBeenCalled();

    session.startIdleTimer(onExpiry, 0);
    vi.advanceTimersByTime(61_000);
    expect(onExpiry).not.toHaveBeenCalled();
    expect(session.getIdleMinutes()).toBe(0);
  });

  it('setIdleMinutes reschedules the active timer', () => {
    vi.useFakeTimers();
    const onExpiry = vi.fn();
    session.startIdleTimer(onExpiry, 1);
    session.setIdleMinutes(2);
    vi.advanceTimersByTime(61_000);
    expect(onExpiry).not.toHaveBeenCalled();
    vi.advanceTimersByTime(60_000);
    expect(onExpiry).toHaveBeenCalledTimes(1);
  });

  it('clear zeros private keys and empties vault map', () => {
    const privateKey = new Uint8Array([9, 9, 9]);
    const s = { ...makeSession(), keyPair: { publicKey: new Uint8Array([1]), privateKey } };
    session.set(s);
    session.clear();
    expect(privateKey.every((b) => b === 0)).toBe(true);
    expect(s.vaults.size).toBe(0);
  });
});
