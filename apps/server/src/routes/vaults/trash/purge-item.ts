import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { and, eq, isNotNull } from 'drizzle-orm';
import { VaultItemParamSchema } from '@blindpass/api-schema';
import { vaultItems } from '../../../db/schema.js';
import { getVaultAccess } from '../vault-access.js';

export function registerPurgeItemRoute(app: FastifyInstance): void {
  app.withTypeProvider<ZodTypeProvider>().delete(
    '/vaults/:vaultId/trash/:id',
    {
      schema: { params: VaultItemParamSchema },
    },
    async (request, reply) => {
      const { vaultId, id } = request.params;

      const access = await getVaultAccess(app, vaultId, request.userId);
      if (!access) return reply.status(404).send({ error: 'Vault not found' });
      if (access.role !== 'owner') return reply.status(403).send({ error: 'Forbidden' });

      const [item] = await app.db
        .select({ id: vaultItems.id })
        .from(vaultItems)
        .where(
          and(
            eq(vaultItems.id, id),
            eq(vaultItems.vaultId, vaultId),
            isNotNull(vaultItems.deletedAt),
          ),
        )
        .limit(1);

      if (!item) return reply.status(404).send({ error: 'Item not found in trash' });

      await app.db.delete(vaultItems).where(eq(vaultItems.id, id));

      return reply.status(204).send();
    },
  );
}
