import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../access.js', () => ({
  requireReader: vi.fn(),
  requireWriter: vi.fn(),
}));
vi.mock('../repository.js', () => ({
  listForVault: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  deleteById: vi.fn(),
}));

import { requireReader, requireWriter } from '../../access.js';
import * as folders from '../repository.js';
import { createFolder, deleteFolder, listFolders, updateFolder } from '../service.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = {} as any;

const payload = {
  encryptedNameCiphertext: Buffer.from('c'),
  encryptedNameNonce: Buffer.from('n'),
};

const folderRow = {
  id: 'f1',
  vaultId: 'v1',
  encryptedNameCiphertext: payload.encryptedNameCiphertext,
  encryptedNameNonce: payload.encryptedNameNonce,
  createdAt: new Date(0),
  updatedAt: new Date(0),
};

describe('listFolders', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns folders when caller has reader access', async () => {
    vi.mocked(requireReader).mockResolvedValue(null);
    vi.mocked(folders.listForVault).mockResolvedValue([folderRow]);

    const result = await listFolders(db, 'u1', 'v1');

    expect(result).toEqual({ ok: true, folders: [folderRow] });
    expect(folders.listForVault).toHaveBeenCalledWith(db, 'v1');
  });

  it('propagates vault_not_found without touching the repo', async () => {
    vi.mocked(requireReader).mockResolvedValue('vault_not_found');

    expect(await listFolders(db, 'u1', 'v1')).toEqual({ ok: false, reason: 'vault_not_found' });
    expect(folders.listForVault).not.toHaveBeenCalled();
  });
});

describe('createFolder', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns the inserted folder when caller has write access', async () => {
    vi.mocked(requireWriter).mockResolvedValue(null);
    vi.mocked(folders.create).mockResolvedValue(folderRow);

    const result = await createFolder(db, 'u1', 'v1', payload);

    expect(result).toEqual({ ok: true, folder: folderRow });
    expect(folders.create).toHaveBeenCalledWith(db, 'v1', payload);
  });

  it('propagates vault_not_found from requireWriter', async () => {
    vi.mocked(requireWriter).mockResolvedValue('vault_not_found');
    expect(await createFolder(db, 'u1', 'v1', payload)).toEqual({
      ok: false,
      reason: 'vault_not_found',
    });
    expect(folders.create).not.toHaveBeenCalled();
  });

  it('propagates forbidden from requireWriter', async () => {
    vi.mocked(requireWriter).mockResolvedValue('forbidden');
    expect(await createFolder(db, 'u1', 'v1', payload)).toEqual({
      ok: false,
      reason: 'forbidden',
    });
    expect(folders.create).not.toHaveBeenCalled();
  });
});

describe('updateFolder', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns the updated row on success', async () => {
    vi.mocked(requireWriter).mockResolvedValue(null);
    vi.mocked(folders.update).mockResolvedValue(folderRow);

    expect(await updateFolder(db, 'u1', 'v1', 'f1', payload)).toEqual({
      ok: true,
      folder: folderRow,
    });
  });

  it('returns folder_not_found when the repo update misses', async () => {
    vi.mocked(requireWriter).mockResolvedValue(null);
    vi.mocked(folders.update).mockResolvedValue(null);

    expect(await updateFolder(db, 'u1', 'v1', 'f1', payload)).toEqual({
      ok: false,
      reason: 'folder_not_found',
    });
  });

  it('does not touch the repo when access is denied', async () => {
    vi.mocked(requireWriter).mockResolvedValue('forbidden');
    expect(await updateFolder(db, 'u1', 'v1', 'f1', payload)).toEqual({
      ok: false,
      reason: 'forbidden',
    });
    expect(folders.update).not.toHaveBeenCalled();
  });
});

describe('deleteFolder', () => {
  beforeEach(() => vi.clearAllMocks());

  it('succeeds when the repo reports a deletion', async () => {
    vi.mocked(requireWriter).mockResolvedValue(null);
    vi.mocked(folders.deleteById).mockResolvedValue(true);

    expect(await deleteFolder(db, 'u1', 'v1', 'f1')).toEqual({ ok: true });
  });

  it('returns folder_not_found when the repo reports no rows', async () => {
    vi.mocked(requireWriter).mockResolvedValue(null);
    vi.mocked(folders.deleteById).mockResolvedValue(false);

    expect(await deleteFolder(db, 'u1', 'v1', 'f1')).toEqual({
      ok: false,
      reason: 'folder_not_found',
    });
  });

  it('does not touch the repo when access is denied', async () => {
    vi.mocked(requireWriter).mockResolvedValue('vault_not_found');
    expect(await deleteFolder(db, 'u1', 'v1', 'f1')).toEqual({
      ok: false,
      reason: 'vault_not_found',
    });
    expect(folders.deleteById).not.toHaveBeenCalled();
  });
});
