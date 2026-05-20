import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { PaginationQuerySchema, VaultItemParamSchema } from '@blindpass/api-schema';
import { listVersions } from '../../../vaults/versions/service.js';
import { sendVaultFailure } from '../result.js';

export function registerListVersionsRoute(app: FastifyInstance): void {
  app
    .withTypeProvider<ZodTypeProvider>()
    .get(
      '/vaults/:vaultId/items/:id/versions',
      { schema: { params: VaultItemParamSchema, querystring: PaginationQuerySchema } },
      async (request, reply) => {
        const { vaultId, id } = request.params;
        const { cursor, limit } = request.query;

        const result = await listVersions(app.db, request.userId, vaultId, id, cursor, limit);
        if (!result.ok)
          return sendVaultFailure(reply, result.reason, {
            item_not_found: [404, 'Item not found'],
          });

        const hasMore = result.versions.length > limit;
        const page = hasMore ? result.versions.slice(0, limit) : result.versions;
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
