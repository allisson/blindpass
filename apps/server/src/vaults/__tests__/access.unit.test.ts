import { describe, expect, it, vi } from 'vitest';
import {
  getVaultAccess,
  requireOwner,
  requireReader,
  requireWriter,
  type VaultRole,
} from '../access.js';

function makeChain(result: unknown) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  chain['from'] = vi.fn().mockReturnValue(chain);
  chain['where'] = vi.fn().mockReturnValue(chain);
  chain['limit'] = vi.fn().mockResolvedValue(result);
  return chain;
}

function dbWithRole(role: VaultRole | null) {
  const ownedRows = role === 'owner' ? [{ id: 'v1' }] : [];
  const shareRows = role && role !== 'owner' ? [{ role }] : role === 'owner' ? undefined : [];
  const select = vi
    .fn()
    .mockReturnValueOnce(makeChain(ownedRows))
    .mockReturnValueOnce(makeChain(shareRows ?? []));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { select } as any;
}

describe('getVaultAccess', () => {
  it('returns owner when caller owns the vault', async () => {
    expect(await getVaultAccess(dbWithRole('owner'), 'v1', 'u1')).toEqual({ role: 'owner' });
  });

  it('returns share role when caller is a share recipient', async () => {
    expect(await getVaultAccess(dbWithRole('editor'), 'v1', 'u1')).toEqual({ role: 'editor' });
    expect(await getVaultAccess(dbWithRole('viewer'), 'v1', 'u1')).toEqual({ role: 'viewer' });
  });

  it('returns null when caller has no access', async () => {
    expect(await getVaultAccess(dbWithRole(null), 'v1', 'u1')).toBeNull();
  });
});

describe('requireOwner', () => {
  it('returns null for owner', async () => {
    expect(await requireOwner(dbWithRole('owner'), 'v1', 'u1')).toBeNull();
  });

  it('returns forbidden for editor', async () => {
    expect(await requireOwner(dbWithRole('editor'), 'v1', 'u1')).toBe('forbidden');
  });

  it('returns forbidden for viewer', async () => {
    expect(await requireOwner(dbWithRole('viewer'), 'v1', 'u1')).toBe('forbidden');
  });

  it('returns vault_not_found for non-member', async () => {
    expect(await requireOwner(dbWithRole(null), 'v1', 'u1')).toBe('vault_not_found');
  });
});

describe('requireWriter', () => {
  it('returns null for owner', async () => {
    expect(await requireWriter(dbWithRole('owner'), 'v1', 'u1')).toBeNull();
  });

  it('returns null for editor', async () => {
    expect(await requireWriter(dbWithRole('editor'), 'v1', 'u1')).toBeNull();
  });

  it('returns forbidden for viewer', async () => {
    expect(await requireWriter(dbWithRole('viewer'), 'v1', 'u1')).toBe('forbidden');
  });

  it('returns vault_not_found for non-member', async () => {
    expect(await requireWriter(dbWithRole(null), 'v1', 'u1')).toBe('vault_not_found');
  });
});

describe('requireReader', () => {
  it('returns null for every role', async () => {
    expect(await requireReader(dbWithRole('owner'), 'v1', 'u1')).toBeNull();
    expect(await requireReader(dbWithRole('editor'), 'v1', 'u1')).toBeNull();
    expect(await requireReader(dbWithRole('viewer'), 'v1', 'u1')).toBeNull();
  });

  it('returns vault_not_found for non-member', async () => {
    expect(await requireReader(dbWithRole(null), 'v1', 'u1')).toBe('vault_not_found');
  });
});
