import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { PaginationQuerySchema, VaultIdParamSchema } from '@blindpass/api-schema';
import { getVaultAccess } from '../../../vaults/access.js';
import * as items from '../../../vaults/items/repository.js';
import { toEncryptedVaultItem } from '../../../vaults/items/mapper.js';

const QuerySchema = PaginationQuerySchema.extend({
  updatedAfter: z.iso.datetime().optional(),
  folderId: z.union([z.uuid(), z.literal('unfiled')]).optional(),
});

export function registerListItemsRoute(app: FastifyInstance): void {
  app
    .withTypeProvider<ZodTypeProvider>()
    .get(
      '/vaults/:vaultId/items',
      { schema: { params: VaultIdParamSchema, querystring: QuerySchema } },
      async (request, reply) => {
        const { vaultId } = request.params;
        const { cursor, limit, updatedAfter, folderId } = request.query;

        const access = await getVaultAccess(app.db, vaultId, request.userId);
        if (!access) return reply.status(404).send({ error: 'Vault not found' });

        if (updatedAfter) {
          const since = new Date(updatedAfter);
          const [changedRows, deletedRows] = await Promise.all([
            items.findChangedSince(app.db, vaultId, since, folderId),
            items.findDeletedSince(app.db, vaultId, since),
          ]);
          return reply.status(200).send({
            items: changedRows.map(toEncryptedVaultItem),
            deletedIds: deletedRows.map((r) => r.id),
            serverTime: new Date().toISOString(),
          });
        }

        const rows = await items.findActiveByCursor(app.db, vaultId, cursor, limit, folderId);
        const hasMore = rows.length > limit;
        const page = hasMore ? rows.slice(0, limit) : rows;
        const nextCursor = hasMore ? page[page.length - 1].id : null;

        return reply.status(200).send({
          nextCursor,
          items: page.map(toEncryptedVaultItem),
        });
      },
    );
}
