import { and, eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../db/schema.js';
import { vaultFolders } from '../../db/schema.js';

type Db = NodePgDatabase<typeof schema>;

export type FolderRow = typeof vaultFolders.$inferSelect;

export type EncryptedNamePayload = {
  encryptedNameCiphertext: Buffer;
  encryptedNameNonce: Buffer;
};

export async function listForVault(db: Db, vaultId: string): Promise<FolderRow[]> {
  return db.select().from(vaultFolders).where(eq(vaultFolders.vaultId, vaultId));
}

export async function create(
  db: Db,
  vaultId: string,
  values: EncryptedNamePayload,
): Promise<FolderRow> {
  const [row] = await db
    .insert(vaultFolders)
    .values({ vaultId, ...values })
    .returning();
  return row;
}

export async function update(
  db: Db,
  folderId: string,
  vaultId: string,
  values: EncryptedNamePayload,
): Promise<FolderRow | null> {
  const [row] = await db
    .update(vaultFolders)
    .set({ ...values, updatedAt: new Date() })
    .where(and(eq(vaultFolders.id, folderId), eq(vaultFolders.vaultId, vaultId)))
    .returning();
  return row ?? null;
}

export async function deleteById(db: Db, folderId: string, vaultId: string): Promise<boolean> {
  const [row] = await db
    .delete(vaultFolders)
    .where(and(eq(vaultFolders.id, folderId), eq(vaultFolders.vaultId, vaultId)))
    .returning({ id: vaultFolders.id });
  return Boolean(row);
}
