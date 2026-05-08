import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { PaginationQuerySchema, VaultIdParamSchema } from '@blindpass/api-schema';
import { findOwnedById } from '../../../vaults/repository.js';
import * as shares from '../../../vaults/shares/repository.js';

export function registerListSharesRoute(app: FastifyInstance): void {
  app
    .withTypeProvider<ZodTypeProvider>()
    .get(
      '/vaults/:vaultId/shares',
      { schema: { params: VaultIdParamSchema, querystring: PaginationQuerySchema } },
      async (request, reply) => {
        const { vaultId } = request.params;
        const { cursor, limit } = request.query;

        const vault = await findOwnedById(app.db, vaultId, request.userId);
        if (!vault) return reply.status(404).send({ error: 'Vault not found' });

        const rows = await shares.listForVault(app.db, vaultId, cursor, limit);
        const hasMore = rows.length > limit;
        const page = hasMore ? rows.slice(0, limit) : rows;
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
