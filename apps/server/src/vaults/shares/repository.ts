import { and, asc, eq, gt, or } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../db/schema.js';
import { users, vaultShares } from '../../db/schema.js';

type Db = NodePgDatabase<typeof schema>;

export type ShareListRow = {
  id: string;
  receiverUserId: string;
  receiverUsername: string;
  role: string;
  createdAt: Date;
};

export async function listForVault(
  db: Db,
  vaultId: string,
  cursor: string | undefined,
  limit: number,
): Promise<ShareListRow[]> {
  return db
    .select({
      id: vaultShares.id,
      receiverUserId: vaultShares.receiverUserId,
      receiverUsername: users.username,
      role: vaultShares.role,
      createdAt: vaultShares.createdAt,
    })
    .from(vaultShares)
    .innerJoin(users, eq(users.id, vaultShares.receiverUserId))
    .where(and(eq(vaultShares.vaultId, vaultId), cursor ? gt(vaultShares.id, cursor) : undefined))
    .orderBy(asc(vaultShares.id))
    .limit(limit + 1);
}

export type CreateShareValues = {
  vaultId: string;
  ownerUserId: string;
  receiverUserId: string;
  sealedVaultKey: Buffer;
  role: 'viewer' | 'editor';
};

export async function create(
  db: Db,
  values: CreateShareValues,
): Promise<{ id: string; createdAt: Date }> {
  const [row] = await db
    .insert(vaultShares)
    .values(values)
    .returning({ id: vaultShares.id, createdAt: vaultShares.createdAt });
  return row;
}

export async function findByIdForUser(
  db: Db,
  shareId: string,
  vaultId: string,
  userId: string,
): Promise<{ id: string } | undefined> {
  const [row] = await db
    .select({ id: vaultShares.id })
    .from(vaultShares)
    .where(
      and(
        eq(vaultShares.id, shareId),
        eq(vaultShares.vaultId, vaultId),
        or(eq(vaultShares.ownerUserId, userId), eq(vaultShares.receiverUserId, userId)),
      ),
    )
    .limit(1);
  return row;
}

export async function deleteById(db: Db, shareId: string): Promise<void> {
  await db.delete(vaultShares).where(eq(vaultShares.id, shareId));
}
