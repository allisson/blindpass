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
  const [owned] = await db
    .select({ id: vaults.id })
    .from(vaults)
    .where(and(eq(vaults.id, vaultId), eq(vaults.userId, userId)))
    .limit(1);

  if (owned) return { role: 'owner' };

  const [share] = await db
    .select({ role: vaultShares.role })
    .from(vaultShares)
    .where(and(eq(vaultShares.vaultId, vaultId), eq(vaultShares.receiverUserId, userId)))
    .limit(1);

  if (share) return { role: share.role as VaultRole };

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
