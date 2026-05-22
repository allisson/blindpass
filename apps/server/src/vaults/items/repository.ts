import { and, asc, desc, eq, gt, isNotNull, isNull, max, or } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { uuidv7 } from 'uuidv7';
import * as schema from '../../db/schema.js';
import {
  vaultFolders,
  vaultItems,
  vaultItemVersions,
  vaults,
  vaultShares,
} from '../../db/schema.js';
import type { QuotaSlot } from '../quota.js';

type Db = NodePgDatabase<typeof schema>;

export type VersionedItemRow = {
  id: string;
  folderId: string | null;
  createdAt: Date;
  updatedAt: Date;
  encryptedDataCiphertext: Buffer;
  encryptedDataNonce: Buffer;
  encryptedItemKeyCiphertext: Buffer;
  encryptedItemKeyNonce: Buffer;
};

const VERSIONED_PROJECTION = {
  id: vaultItems.id,
  folderId: vaultItems.folderId,
  createdAt: vaultItems.createdAt,
  updatedAt: vaultItems.updatedAt,
  encryptedDataCiphertext: vaultItemVersions.encryptedDataCiphertext,
  encryptedDataNonce: vaultItemVersions.encryptedDataNonce,
  encryptedItemKeyCiphertext: vaultItemVersions.encryptedItemKeyCiphertext,
  encryptedItemKeyNonce: vaultItemVersions.encryptedItemKeyNonce,
};

function folderCondition(folderId: string | undefined) {
  if (folderId === 'unfiled') return isNull(vaultItems.folderId);
  if (folderId) return eq(vaultItems.folderId, folderId);
  return undefined;
}

export async function findActiveByCursor(
  db: Db,
  vaultId: string,
  cursor: string | undefined,
  limit: number,
  folderId?: string,
): Promise<VersionedItemRow[]> {
  return db
    .selectDistinctOn([vaultItems.id], VERSIONED_PROJECTION)
    .from(vaultItems)
    .innerJoin(vaultItemVersions, eq(vaultItemVersions.itemId, vaultItems.id))
    .where(
      and(
        eq(vaultItems.vaultId, vaultId),
        isNull(vaultItems.deletedAt),
        cursor ? gt(vaultItems.id, cursor) : undefined,
        folderCondition(folderId),
      ),
    )
    .orderBy(asc(vaultItems.id), desc(vaultItemVersions.versionNum))
    .limit(limit + 1);
}

export async function findChangedSince(
  db: Db,
  vaultId: string,
  since: Date,
  folderId?: string,
): Promise<VersionedItemRow[]> {
  return db
    .selectDistinctOn([vaultItems.id], VERSIONED_PROJECTION)
    .from(vaultItems)
    .innerJoin(vaultItemVersions, eq(vaultItemVersions.itemId, vaultItems.id))
    .where(
      and(
        eq(vaultItems.vaultId, vaultId),
        isNull(vaultItems.deletedAt),
        gt(vaultItems.updatedAt, since),
        folderCondition(folderId),
      ),
    )
    .orderBy(asc(vaultItems.id), desc(vaultItemVersions.versionNum))
    .limit(1000);
}

export async function findDeletedSince(
  db: Db,
  vaultId: string,
  since: Date,
): Promise<{ id: string }[]> {
  return db
    .select({ id: vaultItems.id })
    .from(vaultItems)
    .where(
      and(
        eq(vaultItems.vaultId, vaultId),
        isNotNull(vaultItems.deletedAt),
        gt(vaultItems.updatedAt, since),
      ),
    )
    .limit(1000);
}

export type GlobalVersionedItemRow = VersionedItemRow & { vaultId: string };

const GLOBAL_VERSIONED_PROJECTION = {
  ...VERSIONED_PROJECTION,
  vaultId: vaultItems.vaultId,
};

export async function findActiveForUser(
  db: Db,
  userId: string,
  cursor: string | undefined,
  limit: number,
): Promise<GlobalVersionedItemRow[]> {
  return db
    .selectDistinctOn([vaultItems.id], GLOBAL_VERSIONED_PROJECTION)
    .from(vaultItems)
    .innerJoin(vaults, eq(vaults.id, vaultItems.vaultId))
    .leftJoin(vaultShares, eq(vaultShares.vaultId, vaults.id))
    .innerJoin(vaultItemVersions, eq(vaultItemVersions.itemId, vaultItems.id))
    .where(
      and(
        or(eq(vaults.userId, userId), eq(vaultShares.receiverUserId, userId)),
        isNull(vaultItems.deletedAt),
        cursor ? gt(vaultItems.id, cursor) : undefined,
      ),
    )
    .orderBy(asc(vaultItems.id), desc(vaultItemVersions.versionNum))
    .limit(limit + 1);
}

export async function findChangedSinceForUser(
  db: Db,
  userId: string,
  since: Date,
): Promise<GlobalVersionedItemRow[]> {
  return db
    .selectDistinctOn([vaultItems.id], GLOBAL_VERSIONED_PROJECTION)
    .from(vaultItems)
    .innerJoin(vaults, eq(vaults.id, vaultItems.vaultId))
    .leftJoin(vaultShares, eq(vaultShares.vaultId, vaults.id))
    .innerJoin(vaultItemVersions, eq(vaultItemVersions.itemId, vaultItems.id))
    .where(
      and(
        or(eq(vaults.userId, userId), eq(vaultShares.receiverUserId, userId)),
        isNull(vaultItems.deletedAt),
        gt(vaultItems.updatedAt, since),
      ),
    )
    .orderBy(asc(vaultItems.id), desc(vaultItemVersions.versionNum))
    .limit(1000);
}

export async function findDeletedSinceForUser(
  db: Db,
  userId: string,
  since: Date,
): Promise<{ id: string }[]> {
  return db
    .selectDistinct({ id: vaultItems.id })
    .from(vaultItems)
    .innerJoin(vaults, eq(vaults.id, vaultItems.vaultId))
    .leftJoin(vaultShares, eq(vaultShares.vaultId, vaults.id))
    .where(
      and(
        or(eq(vaults.userId, userId), eq(vaultShares.receiverUserId, userId)),
        isNotNull(vaultItems.deletedAt),
        gt(vaultItems.updatedAt, since),
      ),
    )
    .limit(1000);
}

export type EncryptedItemPayload = {
  encryptedDataCiphertext: Buffer;
  encryptedDataNonce: Buffer;
  encryptedItemKeyCiphertext: Buffer;
  encryptedItemKeyNonce: Buffer;
};

export type CreateItemValues = EncryptedItemPayload & { folderId: string | null };

export async function createWithVersion(
  db: Db,
  slot: QuotaSlot,
  values: CreateItemValues,
): Promise<VersionedItemRow> {
  const [item] = await db
    .insert(vaultItems)
    .values({ vaultId: slot.vaultId, folderId: values.folderId })
    .returning();
  await db.insert(vaultItemVersions).values({
    itemId: item.id,
    versionNum: 1,
    encryptedDataCiphertext: values.encryptedDataCiphertext,
    encryptedDataNonce: values.encryptedDataNonce,
    encryptedItemKeyCiphertext: values.encryptedItemKeyCiphertext,
    encryptedItemKeyNonce: values.encryptedItemKeyNonce,
  });
  return {
    id: item.id,
    folderId: item.folderId,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    encryptedDataCiphertext: values.encryptedDataCiphertext,
    encryptedDataNonce: values.encryptedDataNonce,
    encryptedItemKeyCiphertext: values.encryptedItemKeyCiphertext,
    encryptedItemKeyNonce: values.encryptedItemKeyNonce,
  };
}

export type BatchCreatedRow = { id: string; createdAt: Date; updatedAt: Date };

export async function batchCreateWithVersion(
  db: Db,
  slot: QuotaSlot,
  items: (EncryptedItemPayload & { folderId: string | null })[],
): Promise<BatchCreatedRow[]> {
  const ids = items.map(() => uuidv7());

  const inserted = await db
    .insert(vaultItems)
    .values(ids.map((id, i) => ({ id, vaultId: slot.vaultId, folderId: items[i]!.folderId })))
    .returning();

  await db.insert(vaultItemVersions).values(
    ids.map((id, i) => ({
      itemId: id,
      versionNum: 1,
      encryptedDataCiphertext: items[i]!.encryptedDataCiphertext,
      encryptedDataNonce: items[i]!.encryptedDataNonce,
      encryptedItemKeyCiphertext: items[i]!.encryptedItemKeyCiphertext,
      encryptedItemKeyNonce: items[i]!.encryptedItemKeyNonce,
    })),
  );

  const map = new Map(inserted.map((r) => [r.id, r]));
  return ids.map((id) => {
    const r = map.get(id)!;
    return { id: r.id, createdAt: r.createdAt, updatedAt: r.updatedAt };
  });
}

export async function updateWithNewVersion(
  db: Db,
  vaultId: string,
  itemId: string,
  values: EncryptedItemPayload,
): Promise<VersionedItemRow | null> {
  const [existing] = await db
    .select({ id: vaultItems.id })
    .from(vaultItems)
    .where(
      and(eq(vaultItems.id, itemId), eq(vaultItems.vaultId, vaultId), isNull(vaultItems.deletedAt)),
    )
    .limit(1);
  if (!existing) return null;

  const [maxRow] = await db
    .select({ max: max(vaultItemVersions.versionNum) })
    .from(vaultItemVersions)
    .where(eq(vaultItemVersions.itemId, itemId));
  const nextVersionNum = (maxRow?.max ?? 0) + 1;

  await db.insert(vaultItemVersions).values({
    itemId,
    versionNum: nextVersionNum,
    encryptedDataCiphertext: values.encryptedDataCiphertext,
    encryptedDataNonce: values.encryptedDataNonce,
    encryptedItemKeyCiphertext: values.encryptedItemKeyCiphertext,
    encryptedItemKeyNonce: values.encryptedItemKeyNonce,
  });

  const [updated] = await db
    .update(vaultItems)
    .set({ updatedAt: new Date() })
    .where(eq(vaultItems.id, itemId))
    .returning({
      id: vaultItems.id,
      folderId: vaultItems.folderId,
      createdAt: vaultItems.createdAt,
      updatedAt: vaultItems.updatedAt,
    });

  return {
    id: updated.id,
    folderId: updated.folderId,
    createdAt: updated.createdAt,
    updatedAt: updated.updatedAt,
    encryptedDataCiphertext: values.encryptedDataCiphertext,
    encryptedDataNonce: values.encryptedDataNonce,
    encryptedItemKeyCiphertext: values.encryptedItemKeyCiphertext,
    encryptedItemKeyNonce: values.encryptedItemKeyNonce,
  };
}

export async function softDelete(db: Db, vaultId: string, itemId: string): Promise<boolean> {
  const [existing] = await db
    .select({ id: vaultItems.id })
    .from(vaultItems)
    .where(
      and(eq(vaultItems.id, itemId), eq(vaultItems.vaultId, vaultId), isNull(vaultItems.deletedAt)),
    )
    .limit(1);
  if (!existing) return false;
  await db.update(vaultItems).set({ deletedAt: new Date() }).where(eq(vaultItems.id, itemId));
  return true;
}

export async function moveToFolder(
  db: Db,
  vaultId: string,
  itemId: string,
  folderId: string | null,
): Promise<boolean> {
  const [updated] = await db
    .update(vaultItems)
    .set({ folderId, updatedAt: new Date() })
    .where(
      and(eq(vaultItems.id, itemId), eq(vaultItems.vaultId, vaultId), isNull(vaultItems.deletedAt)),
    )
    .returning({ id: vaultItems.id });
  return Boolean(updated);
}

export async function folderExistsInVault(
  db: Db,
  folderId: string,
  vaultId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ id: vaultFolders.id })
    .from(vaultFolders)
    .where(and(eq(vaultFolders.id, folderId), eq(vaultFolders.vaultId, vaultId)))
    .limit(1);
  return Boolean(row);
}
