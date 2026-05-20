import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { TxDb } from '../../db/tx.js';
import type * as schema from '../../db/schema.js';
import { requireOwner, requireReader, requireWriter, type AccessFailure } from '../access.js';
import * as trash from './repository.js';
import type { TrashedItemRow } from './repository.js';

type Db = TxDb;
type ReadDb = NodePgDatabase<typeof schema>;

export type ListTrashResult =
  | { ok: true; items: TrashedItemRow[] }
  | { ok: false; reason: AccessFailure };

export async function listTrash(
  db: ReadDb,
  userId: string,
  vaultId: string,
  cursor: string | undefined,
  limit: number,
): Promise<ListTrashResult> {
  const accessFail = await requireReader(db, vaultId, userId);
  if (accessFail) return { ok: false, reason: accessFail };
  const rows = await trash.listForVault(db, vaultId, cursor, limit);
  return { ok: true, items: rows };
}

export type RestoreItemResult =
  | { ok: true }
  | { ok: false; reason: AccessFailure | 'item_not_found' };

export async function restoreItem(
  db: Db,
  userId: string,
  vaultId: string,
  itemId: string,
): Promise<RestoreItemResult> {
  const accessFail = await requireWriter(db, vaultId, userId);
  if (accessFail) return { ok: false, reason: accessFail };

  const found = await trash.findTrashedById(db, itemId, vaultId);
  if (!found) return { ok: false, reason: 'item_not_found' };
  await trash.restoreById(db, itemId);
  return { ok: true };
}

export type PurgeItemResult =
  | { ok: true }
  | { ok: false; reason: AccessFailure | 'item_not_found' };

export async function purgeItem(
  db: Db,
  userId: string,
  vaultId: string,
  itemId: string,
): Promise<PurgeItemResult> {
  const accessFail = await requireOwner(db, vaultId, userId);
  if (accessFail) return { ok: false, reason: accessFail };

  const found = await trash.findTrashedById(db, itemId, vaultId);
  if (!found) return { ok: false, reason: 'item_not_found' };
  await trash.purgeById(db, itemId);
  return { ok: true };
}

export type EmptyTrashResult = { ok: true } | { ok: false; reason: AccessFailure };

export async function emptyVaultTrash(
  db: Db,
  userId: string,
  vaultId: string,
): Promise<EmptyTrashResult> {
  const accessFail = await requireOwner(db, vaultId, userId);
  if (accessFail) return { ok: false, reason: accessFail };
  await trash.emptyForVault(db, vaultId);
  return { ok: true };
}

export async function emptyUserTrash(db: Db, userId: string): Promise<void> {
  await trash.emptyForUser(db, userId);
}
