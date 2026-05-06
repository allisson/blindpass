import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { and, asc, eq, gt } from 'drizzle-orm';
import { PaginationQuerySchema, VaultItemParamSchema } from '@blindpass/api-schema';
import { vaultItems, vaultItemVersions } from '../../../db/schema.js';
import { getVaultAccess } from '../vault-access.js';

export function registerListVersionsRoute(app: FastifyInstance): void {
  app.withTypeProvider<ZodTypeProvider>().get(
    '/vaults/:vaultId/items/:id/versions',
    {
      schema: { params: VaultItemParamSchema, querystring: PaginationQuerySchema },
    },
    async (request, reply) => {
      const { vaultId, id } = request.params;
      const { cursor, limit } = request.query;

      const access = await getVaultAccess(app, vaultId, request.userId);
      if (!access) return reply.status(404).send({ error: 'Vault not found' });

      const [item] = await app.db
        .select({ id: vaultItems.id })
        .from(vaultItems)
        .where(and(eq(vaultItems.id, id), eq(vaultItems.vaultId, vaultId)))
        .limit(1);

      if (!item) return reply.status(404).send({ error: 'Item not found' });

      const rows = await app.db
        .select({
          id: vaultItemVersions.id,
          versionNum: vaultItemVersions.versionNum,
          createdAt: vaultItemVersions.createdAt,
        })
        .from(vaultItemVersions)
        .where(
          and(
            eq(vaultItemVersions.itemId, id),
            cursor ? gt(vaultItemVersions.id, cursor) : undefined,
          ),
        )
        .orderBy(asc(vaultItemVersions.id))
        .limit(limit + 1);

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
