import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Vault } from '@blindpass/api-schema';
import type { CeremonyContext } from './ceremony';
import { finalizeUnlockSession } from './finalizeSession';

const masterKey = new Uint8Array([1, 2, 3]);
const keyPair = { publicKey: new Uint8Array([4]), privateKey: new Uint8Array([5]) };
const vaultKey = new Uint8Array([6, 7, 8]);

const ownedVault = {
  id: 'v1',
  isShared: false,
  encryptedVaultKey: { ciphertext: 'c', nonce: 'n' },
  encryptedVaultData: { ciphertext: 'd', nonce: 'e' },
} as unknown as Vault;

const sharedVault = {
  id: 'v2',
  isShared: true,
  encryptedVaultData: { ciphertext: 'd', nonce: 'e' },
  sealedVaultKey: 'sealed',
  role: 'viewer' as const,
  ownerUsername: 'bob',
  shareId: 's1',
} as unknown as Vault;

function makeCtx(): CeremonyContext & { tracked: Uint8Array[] } {
  const tracked: Uint8Array[] = [];
  return {
    tracked,
    setPhase: vi.fn(),
    trackForZero: vi.fn((k: Uint8Array) => {
      tracked.push(k);
      return k;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any,
    releaseTrackedKeys: vi.fn(),
  };
}

describe('finalizeUnlockSession', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let commitSession: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let buildVaultsMap: any;

  beforeEach(() => {
    commitSession = vi.fn();
    buildVaultsMap = vi
      .fn()
      .mockResolvedValue(
        new Map([['v1', { vaultKey, name: 'Personal', isShared: false, role: 'owner' }]]),
      );
  });

  it('builds vault map, tracks vault keys, calls commitSession, releases, returns activeVaultId', async () => {
    const ctx = makeCtx();
    const result = await finalizeUnlockSession(ctx, {
      masterKey,
      keyPair,
      vaults: [ownedVault],
      buildVaultsMap,
      commitSession,
    });

    expect(result).toEqual({ activeVaultId: 'v1' });
    expect(buildVaultsMap).toHaveBeenCalledWith([ownedVault], masterKey, keyPair);
    expect(ctx.trackForZero).toHaveBeenCalledWith(vaultKey);
    expect(commitSession).toHaveBeenCalledWith(
      'v1',
      expect.any(Map),
      expect.objectContaining({ vaultKey }),
    );
    expect(ctx.releaseTrackedKeys).toHaveBeenCalledOnce();
  });

  it('passes correct activeVaultId and activeVault to commitSession', async () => {
    const ctx = makeCtx();
    let capturedId: string | undefined;
    let capturedVault: unknown;

    await finalizeUnlockSession(ctx, {
      masterKey,
      keyPair,
      vaults: [ownedVault],
      buildVaultsMap,
      commitSession: (id, _map, vault) => {
        capturedId = id;
        capturedVault = vault;
      },
    });

    expect(capturedId).toBe('v1');
    expect(capturedVault).toMatchObject({ vaultKey });
  });

  it('throws when no owned vault in list', async () => {
    const ctx = makeCtx();
    await expect(
      finalizeUnlockSession(ctx, {
        masterKey,
        keyPair,
        vaults: [sharedVault],
        buildVaultsMap,
        commitSession,
      }),
    ).rejects.toThrow('No vault found.');
    expect(buildVaultsMap).not.toHaveBeenCalled();
    expect(commitSession).not.toHaveBeenCalled();
  });

  it('throws when active vault missing from built map', async () => {
    buildVaultsMap.mockResolvedValue(new Map());
    const ctx = makeCtx();
    await expect(
      finalizeUnlockSession(ctx, {
        masterKey,
        keyPair,
        vaults: [ownedVault],
        buildVaultsMap,
        commitSession,
      }),
    ).rejects.toThrow('Active vault missing from session map');
    expect(commitSession).not.toHaveBeenCalled();
  });

  it('tracks vault keys from map before commitSession', async () => {
    const vaultKey2 = new Uint8Array([9]);
    buildVaultsMap.mockResolvedValue(
      new Map([
        ['v1', { vaultKey, name: 'P', isShared: false, role: 'owner' }],
        ['v2', { vaultKey: vaultKey2, name: 'S', isShared: true, role: 'viewer' }],
      ]),
    );
    const ctx = makeCtx();
    let committedAfterTracking = false;

    await finalizeUnlockSession(ctx, {
      masterKey,
      keyPair,
      vaults: [ownedVault],
      buildVaultsMap,
      commitSession: () => {
        committedAfterTracking = ctx.tracked.length === 2;
      },
    });

    expect(committedAfterTracking).toBe(true);
    expect(ctx.tracked).toContain(vaultKey);
    expect(ctx.tracked).toContain(vaultKey2);
  });
});
