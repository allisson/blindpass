import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../access.js', () => ({
  requireOwner: vi.fn(),
  requireReader: vi.fn(),
  requireWriter: vi.fn(),
}));
vi.mock('../repository.js', () => ({
  listForVault: vi.fn(),
  findTrashedById: vi.fn(),
  restoreById: vi.fn(),
  purgeById: vi.fn(),
  emptyForVault: vi.fn(),
  emptyForUser: vi.fn(),
}));

import { requireOwner, requireReader, requireWriter } from '../../access.js';
import * as trash from '../repository.js';
import { emptyUserTrash, emptyVaultTrash, listTrash, purgeItem, restoreItem } from '../service.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = {} as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const trashedRow = { id: 'i1', vaultId: 'v1' } as any;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const trashedPage = [{ id: 'i1' }] as any[];

describe('listTrash', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns items when caller has reader access', async () => {
    vi.mocked(requireReader).mockResolvedValue(null);
    vi.mocked(trash.listForVault).mockResolvedValue(trashedPage);

    const result = await listTrash(db, 'u1', 'v1', undefined, 10);

    expect(result).toEqual({ ok: true, items: trashedPage });
    expect(trash.listForVault).toHaveBeenCalledWith(db, 'v1', undefined, 10);
  });

  it('propagates vault_not_found without touching the repo', async () => {
    vi.mocked(requireReader).mockResolvedValue('vault_not_found');

    expect(await listTrash(db, 'u1', 'v1', undefined, 10)).toEqual({
      ok: false,
      reason: 'vault_not_found',
    });
    expect(trash.listForVault).not.toHaveBeenCalled();
  });
});

describe('restoreItem', () => {
  beforeEach(() => vi.clearAllMocks());

  it('restores the row when caller has write access and the item is trashed', async () => {
    vi.mocked(requireWriter).mockResolvedValue(null);
    vi.mocked(trash.findTrashedById).mockResolvedValue(trashedRow);

    expect(await restoreItem(db, 'u1', 'v1', 'i1')).toEqual({ ok: true });

    expect(trash.findTrashedById).toHaveBeenCalledWith(db, 'i1', 'v1');
    expect(trash.restoreById).toHaveBeenCalledWith(db, 'i1');
  });

  it('returns item_not_found when the row is missing or not in trash', async () => {
    vi.mocked(requireWriter).mockResolvedValue(null);
    vi.mocked(trash.findTrashedById).mockResolvedValue(undefined);

    expect(await restoreItem(db, 'u1', 'v1', 'i1')).toEqual({
      ok: false,
      reason: 'item_not_found',
    });
    expect(trash.restoreById).not.toHaveBeenCalled();
  });

  it('propagates forbidden from requireWriter without touching the repo', async () => {
    vi.mocked(requireWriter).mockResolvedValue('forbidden');

    expect(await restoreItem(db, 'u1', 'v1', 'i1')).toEqual({ ok: false, reason: 'forbidden' });
    expect(trash.findTrashedById).not.toHaveBeenCalled();
    expect(trash.restoreById).not.toHaveBeenCalled();
  });

  it('propagates vault_not_found from requireWriter without touching the repo', async () => {
    vi.mocked(requireWriter).mockResolvedValue('vault_not_found');

    expect(await restoreItem(db, 'u1', 'v1', 'i1')).toEqual({
      ok: false,
      reason: 'vault_not_found',
    });
    expect(trash.findTrashedById).not.toHaveBeenCalled();
  });
});

describe('purgeItem', () => {
  beforeEach(() => vi.clearAllMocks());

  it('hard-deletes the row when caller is the owner and the item is trashed', async () => {
    vi.mocked(requireOwner).mockResolvedValue(null);
    vi.mocked(trash.findTrashedById).mockResolvedValue(trashedRow);

    expect(await purgeItem(db, 'u1', 'v1', 'i1')).toEqual({ ok: true });
    expect(trash.purgeById).toHaveBeenCalledWith(db, 'i1');
  });

  it('returns item_not_found when the row is missing', async () => {
    vi.mocked(requireOwner).mockResolvedValue(null);
    vi.mocked(trash.findTrashedById).mockResolvedValue(undefined);

    expect(await purgeItem(db, 'u1', 'v1', 'i1')).toEqual({
      ok: false,
      reason: 'item_not_found',
    });
    expect(trash.purgeById).not.toHaveBeenCalled();
  });

  it('rejects editors with forbidden — purge is owner-only', async () => {
    vi.mocked(requireOwner).mockResolvedValue('forbidden');

    expect(await purgeItem(db, 'u1', 'v1', 'i1')).toEqual({ ok: false, reason: 'forbidden' });
    expect(trash.findTrashedById).not.toHaveBeenCalled();
    expect(trash.purgeById).not.toHaveBeenCalled();
  });
});

describe('emptyVaultTrash', () => {
  beforeEach(() => vi.clearAllMocks());

  it('empties the vault trash when caller is the owner', async () => {
    vi.mocked(requireOwner).mockResolvedValue(null);

    expect(await emptyVaultTrash(db, 'u1', 'v1')).toEqual({ ok: true });
    expect(trash.emptyForVault).toHaveBeenCalledWith(db, 'v1');
  });

  it('rejects editors with forbidden — empty-vault is owner-only', async () => {
    vi.mocked(requireOwner).mockResolvedValue('forbidden');

    expect(await emptyVaultTrash(db, 'u1', 'v1')).toEqual({ ok: false, reason: 'forbidden' });
    expect(trash.emptyForVault).not.toHaveBeenCalled();
  });

  it('propagates vault_not_found when the vault is missing', async () => {
    vi.mocked(requireOwner).mockResolvedValue('vault_not_found');

    expect(await emptyVaultTrash(db, 'u1', 'v1')).toEqual({
      ok: false,
      reason: 'vault_not_found',
    });
    expect(trash.emptyForVault).not.toHaveBeenCalled();
  });
});

describe('emptyUserTrash', () => {
  beforeEach(() => vi.clearAllMocks());

  it('delegates to the repo without any access check — scoped to the caller', async () => {
    await emptyUserTrash(db, 'u1');

    // Intentional: no `requireOwner`/`requireWriter` — the repo filter scopes
    // the delete to vaults owned by the caller.
    expect(requireOwner).not.toHaveBeenCalled();
    expect(requireWriter).not.toHaveBeenCalled();
    expect(trash.emptyForUser).toHaveBeenCalledWith(db, 'u1');
  });
});
