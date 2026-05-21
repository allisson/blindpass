import { lock as zeroKeys } from '@blindpass/vault';
import type { Keychain, KeyPair } from '@blindpass/crypto';

const LAST_USERNAME_KEY = 'bp:last-username';

export const getLastUsername = (): string | null => localStorage.getItem(LAST_USERNAME_KEY);
export const setLastUsername = (username: string) =>
  localStorage.setItem(LAST_USERNAME_KEY, username);
export const clearLastUsername = () => localStorage.removeItem(LAST_USERNAME_KEY);

export interface VaultEntry {
  vaultKey: Uint8Array;
  name: string;
  isShared: boolean;
  role?: 'owner' | 'viewer' | 'editor';
  ownerUsername?: string;
  shareId?: string;
}

export interface Session {
  username?: string;
  activeVaultId: string;
  vaults: Map<string, VaultEntry>;
  keychain: Keychain | null;
  keyPair?: KeyPair | null;
}

let _session: Session | null = null;

let _idleTimer: ReturnType<typeof setTimeout> | null = null;
let _idleMinutes = 15;
let _onIdleExpiry: (() => void) | null = null;

const _listeners = new Set<() => void>();

function scheduleIdleTimer() {
  if (_idleTimer !== null) clearTimeout(_idleTimer);
  if (_onIdleExpiry === null || _idleMinutes === 0) return;
  _idleTimer = setTimeout(_onIdleExpiry, _idleMinutes * 60_000);
}

function notifyListeners() {
  _listeners.forEach((fn) => fn());
}

export const session = {
  set: (s: Session) => {
    _session = s;
    notifyListeners();
  },
  get: () => _session,
  switchVault: (vaultId: string) => {
    if (!_session) return;
    const vault = _session.vaults.get(vaultId);
    if (!vault || !_session.keychain) return;
    _session.activeVaultId = vaultId;
    _session.keychain.vaultKey = vault.vaultKey;
    notifyListeners();
  },
  notify: () => {
    notifyListeners();
  },
  subscribe: (fn: () => void): (() => void) => {
    _listeners.add(fn);
    return () => _listeners.delete(fn);
  },
  lock: () => {
    if (_session?.keychain) {
      zeroKeys(_session.keychain);
      _session.keychain = null;
    }
    notifyListeners();
  },
  startIdleTimer: (onExpiry: () => void, minutes: number) => {
    _onIdleExpiry = onExpiry;
    _idleMinutes = minutes;
    scheduleIdleTimer();
  },
  resetIdleTimer: () => {
    scheduleIdleTimer();
  },
  clearIdleTimer: () => {
    if (_idleTimer !== null) {
      clearTimeout(_idleTimer);
      _idleTimer = null;
    }
    _onIdleExpiry = null;
  },
  setIdleMinutes: (minutes: number) => {
    _idleMinutes = minutes;
    scheduleIdleTimer();
  },
  getIdleMinutes: () => _idleMinutes,
  clear: () => {
    if (_session?.keychain) zeroKeys(_session.keychain);
    if (_session?.keyPair?.privateKey) _session.keyPair.privateKey.fill(0);
    if (_session?.vaults) {
      for (const entry of _session.vaults.values()) {
        entry.vaultKey.fill(0);
      }
      _session.vaults.clear();
    }
    _session = null;
    notifyListeners();
  },
};
