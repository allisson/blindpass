import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../access.js', () => ({
  requireOwner: vi.fn(),
}));
vi.mock('../repository.js', () => ({
  listIdsByOwner: vi.fn(),
  deleteById: vi.fn(),
}));

import { requireOwner } from '../access.js';
import * as vaultsRepo from '../repository.js';
import { deleteVault } from '../service.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = {} as any;

describe('deleteVault', () => {
  beforeEach(() => vi.clearAllMocks());

  it('deletes the vault when the caller is the owner and has other vaults', async () => {
    vi.mocked(requireOwner).mockResolvedValue(null);
    vi.mocked(vaultsRepo.listIdsByOwner).mockResolvedValue([{ id: 'v1' }, { id: 'v2' }]);

    expect(await deleteVault(db, 'u1', 'v1')).toEqual({ ok: true });
    expect(vaultsRepo.deleteById).toHaveBeenCalledWith(db, 'v1');
  });

  it('returns last_vault when the caller owns only one vault', async () => {
    vi.mocked(requireOwner).mockResolvedValue(null);
    vi.mocked(vaultsRepo.listIdsByOwner).mockResolvedValue([{ id: 'v1' }]);

    expect(await deleteVault(db, 'u1', 'v1')).toEqual({ ok: false, reason: 'last_vault' });
    expect(vaultsRepo.deleteById).not.toHaveBeenCalled();
  });

  it('propagates forbidden without touching the repo', async () => {
    vi.mocked(requireOwner).mockResolvedValue('forbidden');

    expect(await deleteVault(db, 'u1', 'v1')).toEqual({ ok: false, reason: 'forbidden' });
    expect(vaultsRepo.listIdsByOwner).not.toHaveBeenCalled();
    expect(vaultsRepo.deleteById).not.toHaveBeenCalled();
  });

  it('propagates vault_not_found without touching the repo', async () => {
    vi.mocked(requireOwner).mockResolvedValue('vault_not_found');

    expect(await deleteVault(db, 'u1', 'v1')).toEqual({ ok: false, reason: 'vault_not_found' });
    expect(vaultsRepo.listIdsByOwner).not.toHaveBeenCalled();
    expect(vaultsRepo.deleteById).not.toHaveBeenCalled();
  });
});
