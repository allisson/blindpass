import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../access.js', () => ({
  requireOwner: vi.fn(),
}));
vi.mock('../repository.js', () => ({
  listForVault: vi.fn(),
  create: vi.fn(),
  findByIdForUser: vi.fn(),
  deleteById: vi.fn(),
}));

import { requireOwner } from '../../access.js';
import * as shares from '../repository.js';
import { listShares } from '../service.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = {} as any;
const shareRow = {
  id: 's1',
  receiverUserId: 'u2',
  receiverUsername: 'bob',
  role: 'viewer',
  createdAt: new Date(0),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any;

describe('listShares', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns shares when caller is the vault owner', async () => {
    vi.mocked(requireOwner).mockResolvedValue(null);
    vi.mocked(shares.listForVault).mockResolvedValue([shareRow]);

    const result = await listShares(db, 'u1', 'v1', undefined, 10);

    expect(result).toEqual({ ok: true, shares: [shareRow] });
    expect(shares.listForVault).toHaveBeenCalledWith(db, 'v1', undefined, 10);
  });

  it('propagates forbidden without touching the repo — listing shares is owner-only', async () => {
    vi.mocked(requireOwner).mockResolvedValue('forbidden');

    expect(await listShares(db, 'u1', 'v1', undefined, 10)).toEqual({
      ok: false,
      reason: 'forbidden',
    });
    expect(shares.listForVault).not.toHaveBeenCalled();
  });

  it('propagates vault_not_found without touching the repo', async () => {
    vi.mocked(requireOwner).mockResolvedValue('vault_not_found');

    expect(await listShares(db, 'u1', 'v1', undefined, 10)).toEqual({
      ok: false,
      reason: 'vault_not_found',
    });
    expect(shares.listForVault).not.toHaveBeenCalled();
  });
});
