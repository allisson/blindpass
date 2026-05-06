import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { and, eq, isNotNull } from 'drizzle-orm';
import { VaultIdParamSchema } from '@blindpass/api-schema';
import { vaultItems } from '../../../db/schema.js';
import { getVaultAccess } from '../vault-access.js';

export function registerEmptyTrashRoute(app: FastifyInstance): void {
  app.withTypeProvider<ZodTypeProvider>().delete(
    '/vaults/:vaultId/trash',
    {
      schema: { params: VaultIdParamSchema },
    },
    async (request, reply) => {
      const { vaultId } = request.params;

      const access = await getVaultAccess(app, vaultId, request.userId);
      if (!access) return reply.status(404).send({ error: 'Vault not found' });
      if (access.role !== 'owner') return reply.status(403).send({ error: 'Forbidden' });

      await app.db
        .delete(vaultItems)
        .where(and(eq(vaultItems.vaultId, vaultId), isNotNull(vaultItems.deletedAt)));

      return reply.status(204).send();
    },
  );
}
