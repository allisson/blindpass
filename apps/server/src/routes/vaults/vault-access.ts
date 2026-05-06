import { and, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { vaults, vaultShares } from '../../db/schema.js';

export type VaultRole = 'owner' | 'viewer' | 'editor';

export async function getVaultAccess(
  app: FastifyInstance,
  vaultId: string,
  userId: string,
): Promise<{ role: VaultRole } | null> {
  const [owned] = await app.db
    .select({ id: vaults.id })
    .from(vaults)
    .where(and(eq(vaults.id, vaultId), eq(vaults.userId, userId)))
    .limit(1);

  if (owned) return { role: 'owner' };

  const [share] = await app.db
    .select({ role: vaultShares.role })
    .from(vaultShares)
    .where(and(eq(vaultShares.vaultId, vaultId), eq(vaultShares.receiverUserId, userId)))
    .limit(1);

  if (share) return { role: share.role as VaultRole };

  return null;
}
