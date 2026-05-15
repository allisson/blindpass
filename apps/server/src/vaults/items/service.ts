import type { TxDb } from '../../db/tx.js';
import { requireWriter, type AccessFailure } from '../access.js';
import { assertItemQuota, getEffectiveVaultItemQuota } from '../quota.js';
import * as items from './repository.js';
import type { EncryptedItemPayload, VersionedItemRow, BatchCreatedRow } from './repository.js';

type Db = TxDb;

export type CreateItemInput = EncryptedItemPayload & { folderId: string | null };

export type CreateItemResult =
  | { ok: true; item: VersionedItemRow }
  | { ok: false; reason: AccessFailure | 'folder_not_found' };

export async function createItem(
  db: Db,
  userId: string,
  vaultId: string,
  input: CreateItemInput,
): Promise<CreateItemResult> {
  const accessFail = await requireWriter(db, vaultId, userId);
  if (accessFail) return { ok: false, reason: accessFail };

  if (input.folderId) {
    const exists = await items.folderExistsInVault(db, input.folderId, vaultId);
    if (!exists) return { ok: false, reason: 'folder_not_found' };
  }

  const limit = await getEffectiveVaultItemQuota(db, vaultId);
  await assertItemQuota(db, vaultId, limit, 1);
  const created = await items.createWithVersion(db, vaultId, input);
  return { ok: true, item: created };
}

export type BatchCreateItemsInput = (EncryptedItemPayload & { folderId: string | null })[];

export type BatchCreateItemsResult =
  | { ok: true; items: BatchCreatedRow[] }
  | { ok: false; reason: AccessFailure };

export async function batchCreateItems(
  db: Db,
  userId: string,
  vaultId: string,
  input: BatchCreateItemsInput,
): Promise<BatchCreateItemsResult> {
  const accessFail = await requireWriter(db, vaultId, userId);
  if (accessFail) return { ok: false, reason: accessFail };

  const limit = await getEffectiveVaultItemQuota(db, vaultId);
  await assertItemQuota(db, vaultId, limit, input.length);
  const created = await items.batchCreateWithVersion(db, vaultId, input);
  return { ok: true, items: created };
}

export type UpdateItemInput = EncryptedItemPayload;

export type UpdateItemResult =
  | { ok: true; item: VersionedItemRow }
  | { ok: false; reason: AccessFailure | 'item_not_found' };

export async function updateItem(
  db: Db,
  userId: string,
  vaultId: string,
  itemId: string,
  input: UpdateItemInput,
): Promise<UpdateItemResult> {
  const accessFail = await requireWriter(db, vaultId, userId);
  if (accessFail) return { ok: false, reason: accessFail };

  const updated = await items.updateWithNewVersion(db, vaultId, itemId, input);
  if (!updated) return { ok: false, reason: 'item_not_found' };
  return { ok: true, item: updated };
}

export type DeleteItemResult =
  | { ok: true }
  | { ok: false; reason: AccessFailure | 'item_not_found' };

export async function deleteItem(
  db: Db,
  userId: string,
  vaultId: string,
  itemId: string,
): Promise<DeleteItemResult> {
  const accessFail = await requireWriter(db, vaultId, userId);
  if (accessFail) return { ok: false, reason: accessFail };
  const deleted = await items.softDelete(db, vaultId, itemId);
  if (!deleted) return { ok: false, reason: 'item_not_found' };
  return { ok: true };
}

export type MoveItemResult =
  | { ok: true }
  | { ok: false; reason: AccessFailure | 'folder_not_found' | 'item_not_found' };

export async function moveItem(
  db: Db,
  userId: string,
  vaultId: string,
  itemId: string,
  folderId: string | null,
): Promise<MoveItemResult> {
  const accessFail = await requireWriter(db, vaultId, userId);
  if (accessFail) return { ok: false, reason: accessFail };

  if (folderId) {
    const exists = await items.folderExistsInVault(db, folderId, vaultId);
    if (!exists) return { ok: false, reason: 'folder_not_found' };
  }

  const moved = await items.moveToFolder(db, vaultId, itemId, folderId);
  if (!moved) return { ok: false, reason: 'item_not_found' };
  return { ok: true };
}
