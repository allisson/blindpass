import { and, eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../db/schema.js';
import { vaults, vaultShares } from '../db/schema.js';

type Db = NodePgDatabase<typeof schema>;

export type VaultRole = 'owner' | 'viewer' | 'editor';

export type AccessFailure = 'vault_not_found' | 'forbidden';

export async function getVaultAccess(
  db: Db,
  vaultId: string,
  userId: string,
): Promise<{ role: VaultRole } | null> {
  const [row] = await db
    .select({ vaultUserId: vaults.userId, shareRole: vaultShares.role })
    .from(vaults)
    .leftJoin(
      vaultShares,
      and(eq(vaultShares.vaultId, vaultId), eq(vaultShares.receiverUserId, userId)),
    )
    .where(eq(vaults.id, vaultId))
    .limit(1);

  if (!row) return null;
  if (row.vaultUserId === userId) return { role: 'owner' };
  if (row.shareRole) return { role: row.shareRole as VaultRole };
  return null;
}

export async function requireOwner(
  db: Db,
  vaultId: string,
  userId: string,
): Promise<AccessFailure | null> {
  const access = await getVaultAccess(db, vaultId, userId);
  if (!access) return 'vault_not_found';
  if (access.role !== 'owner') return 'forbidden';
  return null;
}

export async function requireWriter(
  db: Db,
  vaultId: string,
  userId: string,
): Promise<AccessFailure | null> {
  const access = await getVaultAccess(db, vaultId, userId);
  if (!access) return 'vault_not_found';
  if (access.role === 'viewer') return 'forbidden';
  return null;
}

export async function requireReader(
  db: Db,
  vaultId: string,
  userId: string,
): Promise<AccessFailure | null> {
  const access = await getVaultAccess(db, vaultId, userId);
  if (!access) return 'vault_not_found';
  return null;
}
