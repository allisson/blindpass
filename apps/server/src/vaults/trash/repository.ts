import { and, asc, desc, eq, gt, inArray, isNotNull, or } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../db/schema.js';
import { vaults, vaultItems, vaultItemVersions, vaultShares } from '../../db/schema.js';

type Db = NodePgDatabase<typeof schema>;

export type TrashedItemRow = {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  encryptedDataCiphertext: Buffer;
  encryptedDataNonce: Buffer;
  encryptedItemKeyCiphertext: Buffer;
  encryptedItemKeyNonce: Buffer;
};

export type GlobalTrashedItemRow = TrashedItemRow & { vaultId: string };

export async function listForVault(
  db: Db,
  vaultId: string,
  cursor: string | undefined,
  limit: number,
): Promise<TrashedItemRow[]> {
  return db
    .selectDistinctOn([vaultItems.id], {
      id: vaultItems.id,
      createdAt: vaultItems.createdAt,
      updatedAt: vaultItems.updatedAt,
      deletedAt: vaultItems.deletedAt,
      encryptedDataCiphertext: vaultItemVersions.encryptedDataCiphertext,
      encryptedDataNonce: vaultItemVersions.encryptedDataNonce,
      encryptedItemKeyCiphertext: vaultItemVersions.encryptedItemKeyCiphertext,
      encryptedItemKeyNonce: vaultItemVersions.encryptedItemKeyNonce,
    })
    .from(vaultItems)
    .innerJoin(vaultItemVersions, eq(vaultItemVersions.itemId, vaultItems.id))
    .where(
      and(
        eq(vaultItems.vaultId, vaultId),
        isNotNull(vaultItems.deletedAt),
        cursor ? gt(vaultItems.id, cursor) : undefined,
      ),
    )
    .orderBy(asc(vaultItems.id), desc(vaultItemVersions.versionNum))
    .limit(limit + 1);
}

export async function listForUser(
  db: Db,
  userId: string,
  cursor: string | undefined,
  limit: number,
): Promise<GlobalTrashedItemRow[]> {
  return db
    .selectDistinctOn([vaultItems.id], {
      id: vaultItems.id,
      vaultId: vaultItems.vaultId,
      createdAt: vaultItems.createdAt,
      updatedAt: vaultItems.updatedAt,
      deletedAt: vaultItems.deletedAt,
      encryptedDataCiphertext: vaultItemVersions.encryptedDataCiphertext,
      encryptedDataNonce: vaultItemVersions.encryptedDataNonce,
      encryptedItemKeyCiphertext: vaultItemVersions.encryptedItemKeyCiphertext,
      encryptedItemKeyNonce: vaultItemVersions.encryptedItemKeyNonce,
    })
    .from(vaultItems)
    .innerJoin(vaults, eq(vaults.id, vaultItems.vaultId))
    .leftJoin(vaultShares, eq(vaultShares.vaultId, vaults.id))
    .innerJoin(vaultItemVersions, eq(vaultItemVersions.itemId, vaultItems.id))
    .where(
      and(
        or(eq(vaults.userId, userId), eq(vaultShares.receiverUserId, userId)),
        isNotNull(vaultItems.deletedAt),
        cursor ? gt(vaultItems.id, cursor) : undefined,
      ),
    )
    .orderBy(asc(vaultItems.id), desc(vaultItemVersions.versionNum))
    .limit(limit + 1);
}

export async function findTrashedById(
  db: Db,
  itemId: string,
  vaultId: string,
): Promise<{ id: string } | undefined> {
  const [row] = await db
    .select({ id: vaultItems.id })
    .from(vaultItems)
    .where(
      and(
        eq(vaultItems.id, itemId),
        eq(vaultItems.vaultId, vaultId),
        isNotNull(vaultItems.deletedAt),
      ),
    )
    .limit(1);
  return row;
}

export async function restoreById(db: Db, itemId: string): Promise<void> {
  await db.update(vaultItems).set({ deletedAt: null }).where(eq(vaultItems.id, itemId));
}

export async function purgeById(db: Db, itemId: string): Promise<void> {
  await db.delete(vaultItems).where(eq(vaultItems.id, itemId));
}

export async function emptyForVault(db: Db, vaultId: string): Promise<void> {
  await db
    .delete(vaultItems)
    .where(and(eq(vaultItems.vaultId, vaultId), isNotNull(vaultItems.deletedAt)));
}

export async function emptyForUser(db: Db, userId: string): Promise<void> {
  const userVaults = await db
    .select({ id: vaults.id })
    .from(vaults)
    .where(eq(vaults.userId, userId));
  if (userVaults.length === 0) return;
  const vaultIds = userVaults.map((v) => v.id);
  await db
    .delete(vaultItems)
    .where(and(inArray(vaultItems.vaultId, vaultIds), isNotNull(vaultItems.deletedAt)));
}
