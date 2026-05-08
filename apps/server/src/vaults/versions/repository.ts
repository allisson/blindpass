import { and, asc, eq, gt } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../db/schema.js';
import { vaultItems, vaultItemVersions } from '../../db/schema.js';

type Db = NodePgDatabase<typeof schema>;

export type VersionRow = typeof vaultItemVersions.$inferSelect;

export async function findItemInVault(
  db: Db,
  itemId: string,
  vaultId: string,
): Promise<{ id: string } | undefined> {
  const [row] = await db
    .select({ id: vaultItems.id })
    .from(vaultItems)
    .where(and(eq(vaultItems.id, itemId), eq(vaultItems.vaultId, vaultId)))
    .limit(1);
  return row;
}

export type VersionSummary = { id: string; versionNum: number; createdAt: Date };

export async function listForItem(
  db: Db,
  itemId: string,
  cursor: string | undefined,
  limit: number,
): Promise<VersionSummary[]> {
  return db
    .select({
      id: vaultItemVersions.id,
      versionNum: vaultItemVersions.versionNum,
      createdAt: vaultItemVersions.createdAt,
    })
    .from(vaultItemVersions)
    .where(
      and(
        eq(vaultItemVersions.itemId, itemId),
        cursor ? gt(vaultItemVersions.id, cursor) : undefined,
      ),
    )
    .orderBy(asc(vaultItemVersions.id))
    .limit(limit + 1);
}

export async function findById(
  db: Db,
  versionId: string,
  itemId: string,
): Promise<VersionRow | undefined> {
  const [row] = await db
    .select()
    .from(vaultItemVersions)
    .where(and(eq(vaultItemVersions.id, versionId), eq(vaultItemVersions.itemId, itemId)))
    .limit(1);
  return row;
}
