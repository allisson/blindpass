import { describe, it, expect, vi, beforeEach } from 'vitest';

const vaultClearAll = vi.fn().mockResolvedValue(undefined);
const enrollmentClearAll = vi.fn().mockResolvedValue(undefined);

vi.mock('./vaultCache', () => ({ vaultCache: { clearAll: () => vaultClearAll() } }));
vi.mock('./biometric', () => ({ enrollmentStore: { clearAll: () => enrollmentClearAll() } }));

import { session, type Session } from './session';
import './session-lifecycle';

function makeSession(): Session {
  return {
    username: 'user_test',
    activeVaultId: 'v1',
    vaults: new Map([
      ['v1', { vaultKey: new Uint8Array([7, 8, 9]), name: 'Main', isShared: false }],
    ]),
    keychain: { masterKey: new Uint8Array([1]), vaultKey: new Uint8Array([4]) },
    keyPair: null,
  };
}

beforeEach(() => {
  session.clear();
  vi.clearAllMocks();
});

describe('session-lifecycle', () => {
  it('clears vaultCache but not enrollmentStore on lock', () => {
    session.set(makeSession());
    vi.clearAllMocks();
    session.lock();
    expect(vaultClearAll).toHaveBeenCalledTimes(1);
    expect(enrollmentClearAll).not.toHaveBeenCalled();
  });

  it('clears both stores on clear', () => {
    session.set(makeSession());
    vi.clearAllMocks();
    session.clear();
    expect(vaultClearAll).toHaveBeenCalledTimes(1);
    expect(enrollmentClearAll).toHaveBeenCalledTimes(1);
  });

  it('clears vaultCache when already locked (keychain already null)', () => {
    session.set({ ...makeSession(), keychain: null });
    vi.clearAllMocks();
    session.lock();
    expect(vaultClearAll).toHaveBeenCalledTimes(1);
    expect(enrollmentClearAll).not.toHaveBeenCalled();
  });

  it('swallows vaultCache.clearAll rejection', async () => {
    vaultClearAll.mockRejectedValueOnce(new Error('storage error'));
    session.set(makeSession());
    vi.clearAllMocks();
    vaultClearAll.mockRejectedValueOnce(new Error('storage error'));
    session.lock();
    await new Promise((r) => setTimeout(r, 0));
    expect(vaultClearAll).toHaveBeenCalledTimes(1);
  });

  it('swallows enrollmentStore.clearAll rejection', async () => {
    enrollmentClearAll.mockRejectedValueOnce(new Error('storage error'));
    session.set(makeSession());
    vi.clearAllMocks();
    enrollmentClearAll.mockRejectedValueOnce(new Error('storage error'));
    session.clear();
    await new Promise((r) => setTimeout(r, 0));
    expect(enrollmentClearAll).toHaveBeenCalledTimes(1);
  });

  it('does not clear stores on set or switchVault', () => {
    session.set(makeSession());
    vi.clearAllMocks();

    const s = makeSession();
    s.vaults.set('v2', { vaultKey: new Uint8Array([20]), name: 'Work', isShared: false });
    session.set(s);
    expect(vaultClearAll).not.toHaveBeenCalled();
    expect(enrollmentClearAll).not.toHaveBeenCalled();

    session.switchVault('v2');
    expect(vaultClearAll).not.toHaveBeenCalled();
    expect(enrollmentClearAll).not.toHaveBeenCalled();
  });
});
