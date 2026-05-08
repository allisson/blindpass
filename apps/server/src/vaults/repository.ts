import { and, asc, eq, gt } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../db/schema.js';
import { users, vaults, vaultShares } from '../db/schema.js';

type Db = NodePgDatabase<typeof schema>;

export type VaultRow = typeof vaults.$inferSelect;

export type CreateInitialVaultValues = {
  userId: string;
  encryptedVaultKeyCiphertext: Buffer;
  encryptedVaultKeyNonce: Buffer;
  encryptedVaultDataCiphertext: Buffer;
  encryptedVaultDataNonce: Buffer;
};

export async function createInitial(db: Db, values: CreateInitialVaultValues): Promise<void> {
  await db.insert(vaults).values(values);
}

export async function createVault(db: Db, values: CreateInitialVaultValues): Promise<VaultRow> {
  const [row] = await db.insert(vaults).values(values).returning();
  return row;
}

export async function listOwnedByUser(
  db: Db,
  userId: string,
  cursor: string | undefined,
  limit: number,
): Promise<VaultRow[]> {
  return db
    .select()
    .from(vaults)
    .where(and(eq(vaults.userId, userId), cursor ? gt(vaults.id, cursor) : undefined))
    .orderBy(asc(vaults.id))
    .limit(limit + 1);
}

export type SharedVaultRow = {
  shareId: string;
  sealedVaultKey: Buffer;
  role: string;
  vaultId: string;
  encryptedVaultDataCiphertext: Buffer;
  encryptedVaultDataNonce: Buffer;
  ownerUsername: string;
  createdAt: Date;
  updatedAt: Date;
};

export async function listSharedWithUser(
  db: Db,
  userId: string,
  cursor: string | undefined,
  limit: number,
): Promise<SharedVaultRow[]> {
  return db
    .select({
      shareId: vaultShares.id,
      sealedVaultKey: vaultShares.sealedVaultKey,
      role: vaultShares.role,
      vaultId: vaults.id,
      encryptedVaultDataCiphertext: vaults.encryptedVaultDataCiphertext,
      encryptedVaultDataNonce: vaults.encryptedVaultDataNonce,
      ownerUsername: users.username,
      createdAt: vaults.createdAt,
      updatedAt: vaults.updatedAt,
    })
    .from(vaultShares)
    .innerJoin(vaults, eq(vaults.id, vaultShares.vaultId))
    .innerJoin(users, eq(users.id, vaultShares.ownerUserId))
    .where(and(eq(vaultShares.receiverUserId, userId), cursor ? gt(vaults.id, cursor) : undefined))
    .orderBy(asc(vaults.id))
    .limit(limit + 1);
}

export async function findOwnedById(
  db: Db,
  vaultId: string,
  userId: string,
): Promise<{ id: string } | undefined> {
  const [row] = await db
    .select({ id: vaults.id })
    .from(vaults)
    .where(and(eq(vaults.id, vaultId), eq(vaults.userId, userId)))
    .limit(1);
  return row;
}

export async function updateMetadata(
  db: Db,
  vaultId: string,
  ownerId: string,
  values: { encryptedVaultDataCiphertext: Buffer; encryptedVaultDataNonce: Buffer },
): Promise<VaultRow | null> {
  const [row] = await db
    .update(vaults)
    .set({
      encryptedVaultDataCiphertext: values.encryptedVaultDataCiphertext,
      encryptedVaultDataNonce: values.encryptedVaultDataNonce,
      updatedAt: new Date(),
    })
    .where(and(eq(vaults.id, vaultId), eq(vaults.userId, ownerId)))
    .returning();
  return row ?? null;
}

export async function listIdsByOwner(db: Db, userId: string): Promise<{ id: string }[]> {
  return db.select({ id: vaults.id }).from(vaults).where(eq(vaults.userId, userId));
}
