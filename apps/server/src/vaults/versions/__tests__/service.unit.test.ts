import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../access.js', () => ({
  requireReader: vi.fn(),
}));
vi.mock('../repository.js', () => ({
  findItemInVault: vi.fn(),
  listForItem: vi.fn(),
}));

import { requireReader } from '../../access.js';
import * as versions from '../repository.js';
import { listVersions } from '../service.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = {} as any;
const versionRow = { id: 'ver1', versionNum: 1, createdAt: new Date(0) };

describe('listVersions', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns versions when caller has reader access and item exists', async () => {
    vi.mocked(requireReader).mockResolvedValue(null);
    vi.mocked(versions.findItemInVault).mockResolvedValue({ id: 'item1' });
    vi.mocked(versions.listForItem).mockResolvedValue([versionRow]);

    const result = await listVersions(db, 'u1', 'v1', 'item1', undefined, 10);

    expect(result).toEqual({ ok: true, versions: [versionRow] });
    expect(versions.findItemInVault).toHaveBeenCalledWith(db, 'item1', 'v1');
    expect(versions.listForItem).toHaveBeenCalledWith(db, 'item1', undefined, 10);
  });

  it('returns item_not_found when item does not exist in vault', async () => {
    vi.mocked(requireReader).mockResolvedValue(null);
    vi.mocked(versions.findItemInVault).mockResolvedValue(undefined);

    const result = await listVersions(db, 'u1', 'v1', 'item1', undefined, 10);

    expect(result).toEqual({ ok: false, reason: 'item_not_found' });
    expect(versions.listForItem).not.toHaveBeenCalled();
  });

  it('propagates vault_not_found without touching the repo', async () => {
    vi.mocked(requireReader).mockResolvedValue('vault_not_found');

    expect(await listVersions(db, 'u1', 'v1', 'item1', undefined, 10)).toEqual({
      ok: false,
      reason: 'vault_not_found',
    });
    expect(versions.findItemInVault).not.toHaveBeenCalled();
    expect(versions.listForItem).not.toHaveBeenCalled();
  });
});
