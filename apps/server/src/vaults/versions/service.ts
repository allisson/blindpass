import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type * as schema from '../../db/schema.js';
import { requireReader, type AccessFailure } from '../access.js';
import * as versions from './repository.js';
import type { VersionSummary } from './repository.js';

type ReadDb = NodePgDatabase<typeof schema>;

export type ListVersionsResult =
  | { ok: true; versions: VersionSummary[] }
  | { ok: false; reason: AccessFailure | 'item_not_found' };

export async function listVersions(
  db: ReadDb,
  userId: string,
  vaultId: string,
  itemId: string,
  cursor: string | undefined,
  limit: number,
): Promise<ListVersionsResult> {
  const accessFail = await requireReader(db, vaultId, userId);
  if (accessFail) return { ok: false, reason: accessFail };
  const item = await versions.findItemInVault(db, itemId, vaultId);
  if (!item) return { ok: false, reason: 'item_not_found' };
  const rows = await versions.listForItem(db, itemId, cursor, limit);
  return { ok: true, versions: rows };
}
