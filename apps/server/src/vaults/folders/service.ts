import type { TxDb } from '../../db/tx.js';
import { requireWriter, type AccessFailure } from '../access.js';
import * as folders from './repository.js';
import type { EncryptedNamePayload, FolderRow } from './repository.js';

type Db = TxDb;

export type CreateFolderResult =
  | { ok: true; folder: FolderRow }
  | { ok: false; reason: AccessFailure };

export async function createFolder(
  db: Db,
  userId: string,
  vaultId: string,
  input: EncryptedNamePayload,
): Promise<CreateFolderResult> {
  const accessFail = await requireWriter(db, vaultId, userId);
  if (accessFail) return { ok: false, reason: accessFail };
  const folder = await folders.create(db, vaultId, input);
  return { ok: true, folder };
}

export type UpdateFolderResult =
  | { ok: true; folder: FolderRow }
  | { ok: false; reason: AccessFailure | 'folder_not_found' };

export async function updateFolder(
  db: Db,
  userId: string,
  vaultId: string,
  folderId: string,
  input: EncryptedNamePayload,
): Promise<UpdateFolderResult> {
  const accessFail = await requireWriter(db, vaultId, userId);
  if (accessFail) return { ok: false, reason: accessFail };
  const folder = await folders.update(db, folderId, vaultId, input);
  if (!folder) return { ok: false, reason: 'folder_not_found' };
  return { ok: true, folder };
}

export type DeleteFolderResult =
  | { ok: true }
  | { ok: false; reason: AccessFailure | 'folder_not_found' };

export async function deleteFolder(
  db: Db,
  userId: string,
  vaultId: string,
  folderId: string,
): Promise<DeleteFolderResult> {
  const accessFail = await requireWriter(db, vaultId, userId);
  if (accessFail) return { ok: false, reason: accessFail };
  const deleted = await folders.deleteById(db, folderId, vaultId);
  if (!deleted) return { ok: false, reason: 'folder_not_found' };
  return { ok: true };
}
