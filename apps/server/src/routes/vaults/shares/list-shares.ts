import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { PaginationQuerySchema, VaultIdParamSchema } from '@blindpass/api-schema';
import { listShares } from '../../../vaults/shares/service.js';

export function registerListSharesRoute(app: FastifyInstance): void {
  app
    .withTypeProvider<ZodTypeProvider>()
    .get(
      '/vaults/:vaultId/shares',
      { schema: { params: VaultIdParamSchema, querystring: PaginationQuerySchema } },
      async (request, reply) => {
        const { vaultId } = request.params;
        const { cursor, limit } = request.query;

        const result = await listShares(app.db, request.userId, vaultId, cursor, limit);
        if (!result.ok) return reply.status(404).send({ error: 'Vault not found' });

        const hasMore = result.shares.length > limit;
        const page = hasMore ? result.shares.slice(0, limit) : result.shares;
        const nextCursor = hasMore ? page[page.length - 1].id : null;

        return reply.status(200).send({
          nextCursor,
          shares: page.map((s) => ({
            id: s.id,
            receiverUserId: s.receiverUserId,
            receiverUsername: s.receiverUsername,
            role: s.role as 'viewer' | 'editor',
            createdAt: s.createdAt.toISOString(),
          })),
        });
      },
    );
}
