import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { PaginationQuerySchema, VaultItemParamSchema } from '@blindpass/api-schema';
import { getVaultAccess } from '../../../vaults/access.js';
import * as versions from '../../../vaults/versions/repository.js';

export function registerListVersionsRoute(app: FastifyInstance): void {
  app
    .withTypeProvider<ZodTypeProvider>()
    .get(
      '/vaults/:vaultId/items/:id/versions',
      { schema: { params: VaultItemParamSchema, querystring: PaginationQuerySchema } },
      async (request, reply) => {
        const { vaultId, id } = request.params;
        const { cursor, limit } = request.query;

        const access = await getVaultAccess(app.db, vaultId, request.userId);
        if (!access) return reply.status(404).send({ error: 'Vault not found' });

        const item = await versions.findItemInVault(app.db, id, vaultId);
        if (!item) return reply.status(404).send({ error: 'Item not found' });

        const rows = await versions.listForItem(app.db, id, cursor, limit);
        const hasMore = rows.length > limit;
        const page = hasMore ? rows.slice(0, limit) : rows;
        const nextCursor = hasMore ? page[page.length - 1].id : null;

        return reply.status(200).send({
          nextCursor,
          versions: page.map((v) => ({
            id: v.id,
            versionNum: v.versionNum,
            createdAt: v.createdAt.toISOString(),
          })),
        });
      },
    );
}
