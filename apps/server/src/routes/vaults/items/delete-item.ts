import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { and, eq, isNull } from 'drizzle-orm';
import { VaultItemParamSchema } from '@blindpass/api-schema';
import { vaultItems } from '../../../db/schema.js';
import { getVaultAccess } from '../vault-access.js';

export function registerDeleteItemRoute(app: FastifyInstance): void {
  app.withTypeProvider<ZodTypeProvider>().delete(
    '/vaults/:vaultId/items/:id',
    {
      schema: { params: VaultItemParamSchema },
    },
    async (request, reply) => {
      const { vaultId, id } = request.params;

      const access = await getVaultAccess(app, vaultId, request.userId);
      if (!access) return reply.status(404).send({ error: 'Vault not found' });
      if (access.role === 'viewer') return reply.status(403).send({ error: 'Forbidden' });

      const [item] = await app.db
        .select({ id: vaultItems.id })
        .from(vaultItems)
        .where(
          and(eq(vaultItems.id, id), eq(vaultItems.vaultId, vaultId), isNull(vaultItems.deletedAt)),
        )
        .limit(1);

      if (!item) return reply.status(404).send({ error: 'Item not found' });

      await app.db.update(vaultItems).set({ deletedAt: new Date() }).where(eq(vaultItems.id, id));

      return reply.status(204).send();
    },
  );
}
