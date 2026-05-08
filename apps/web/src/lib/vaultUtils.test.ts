import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@blindpass/crypto', () => ({
  decryptSymmetric: vi.fn(async () => new Uint8Array(32)),
  openSealBox: vi.fn(async () => new Uint8Array(32)),
}));

vi.mock('@blindpass/vault', () => ({
  decryptVaultMetadata: vi.fn(async () => ({ name: 'Test Vault' })),
}));

vi.mock('@/lib/b64', () => ({
  fromBase64: vi.fn((v: unknown) => v),
  fromBase64EncryptedValue: vi.fn((v: unknown) => v),
}));

import type { Vault } from '@blindpass/api-schema';
import { decryptSymmetric } from '@blindpass/crypto';
import { openSealBox } from '@blindpass/crypto';
import { buildVaultsMap } from './vaultUtils';

const MASTER_KEY = new Uint8Array(32);
const KEY_PAIR = { publicKey: new Uint8Array(32), privateKey: new Uint8Array(32) };

function makeVault(overrides: Partial<Vault> = {}): Vault {
  return {
    id: 'v1',
    isShared: false,
    role: 'owner',
    encryptedVaultKey: { ciphertext: 'c', nonce: 'n' } as never,
    encryptedVaultData: { ciphertext: 'd', nonce: 'n' } as never,
    sealedVaultKey: null,
    ownerUsername: null,
    shareId: null,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    ...overrides,
  } as Vault;
}

describe('buildVaultsMap', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns empty map for empty input', async () => {
    const map = await buildVaultsMap([], MASTER_KEY, KEY_PAIR);
    expect(map.size).toBe(0);
  });

  it('handles non-shared vault using decryptSymmetric', async () => {
    const map = await buildVaultsMap([makeVault({ id: 'v1' })], MASTER_KEY, KEY_PAIR);
    expect(map.size).toBe(1);
    const entry = map.get('v1')!;
    expect(entry.name).toBe('Test Vault');
    expect(entry.isShared).toBe(false);
    expect(entry.role).toBe('owner');
    expect(entry.ownerUsername).toBeUndefined();
    expect(entry.shareId).toBeUndefined();
    expect(decryptSymmetric).toHaveBeenCalledOnce();
    expect(openSealBox).not.toHaveBeenCalled();
  });

  it('handles shared vault using openSealBox', async () => {
    const map = await buildVaultsMap(
      [
        makeVault({
          id: 'v2',
          isShared: true,
          role: 'viewer',
          ownerUsername: 'alice',
          shareId: 'share-1',
          sealedVaultKey: 'sealed-key-base64',
        }),
      ],
      MASTER_KEY,
      KEY_PAIR,
    );
    expect(map.size).toBe(1);
    const entry = map.get('v2')!;
    expect(entry.isShared).toBe(true);
    expect(entry.role).toBe('viewer');
    expect(entry.ownerUsername).toBe('alice');
    expect(entry.shareId).toBe('share-1');
    expect(openSealBox).toHaveBeenCalledOnce();
    expect(decryptSymmetric).not.toHaveBeenCalled();
  });

  it('handles multiple vaults of mixed types', async () => {
    const map = await buildVaultsMap(
      [
        makeVault({ id: 'v1' }),
        makeVault({
          id: 'v2',
          isShared: true,
          sealedVaultKey: 'sealed',
          ownerUsername: 'bob',
          shareId: 's1',
        }),
      ],
      MASTER_KEY,
      KEY_PAIR,
    );
    expect(map.size).toBe(2);
    expect(map.get('v1')!.isShared).toBe(false);
    expect(map.get('v2')!.isShared).toBe(true);
  });
});
