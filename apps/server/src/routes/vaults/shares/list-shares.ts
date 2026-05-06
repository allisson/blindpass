import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { and, asc, eq, gt } from 'drizzle-orm';
import { PaginationQuerySchema, VaultIdParamSchema } from '@blindpass/api-schema';
import { vaults, vaultShares, users } from '../../../db/schema.js';

export function registerListSharesRoute(app: FastifyInstance): void {
  app.withTypeProvider<ZodTypeProvider>().get(
    '/vaults/:vaultId/shares',
    {
      schema: { params: VaultIdParamSchema, querystring: PaginationQuerySchema },
    },
    async (request, reply) => {
      const { vaultId } = request.params;
      const { cursor, limit } = request.query;

      const [vault] = await app.db
        .select({ id: vaults.id })
        .from(vaults)
        .where(and(eq(vaults.id, vaultId), eq(vaults.userId, request.userId)))
        .limit(1);

      if (!vault) return reply.status(404).send({ error: 'Vault not found' });

      const rows = await app.db
        .select({
          id: vaultShares.id,
          receiverUserId: vaultShares.receiverUserId,
          receiverUsername: users.username,
          role: vaultShares.role,
          createdAt: vaultShares.createdAt,
        })
        .from(vaultShares)
        .innerJoin(users, eq(users.id, vaultShares.receiverUserId))
        .where(
          and(eq(vaultShares.vaultId, vaultId), cursor ? gt(vaultShares.id, cursor) : undefined),
        )
        .orderBy(asc(vaultShares.id))
        .limit(limit + 1);

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
