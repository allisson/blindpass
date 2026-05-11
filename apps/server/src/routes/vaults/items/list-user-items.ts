import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { PaginationQuerySchema } from '@blindpass/api-schema';
import * as items from '../../../vaults/items/repository.js';
import { toEncryptedGlobalVaultItem } from '../../../vaults/items/mapper.js';

const QuerySchema = PaginationQuerySchema.extend({
  updatedAfter: z.iso.datetime().optional(),
});

export function registerListUserItemsRoute(app: FastifyInstance): void {
  app
    .withTypeProvider<ZodTypeProvider>()
    .get('/user/items', { schema: { querystring: QuerySchema } }, async (request, reply) => {
      const { cursor, limit, updatedAfter } = request.query;

      if (updatedAfter) {
        const since = new Date(updatedAfter);
        const [changedRows, deletedRows] = await Promise.all([
          items.findChangedSinceForUser(app.db, request.userId, since),
          items.findDeletedSinceForUser(app.db, request.userId, since),
        ]);
        return reply.status(200).send({
          items: changedRows.map(toEncryptedGlobalVaultItem),
          deletedIds: deletedRows.map((r) => r.id),
          serverTime: new Date().toISOString(),
        });
      }

      const rows = await items.findActiveForUser(app.db, request.userId, cursor, limit);
      const hasMore = rows.length > limit;
      const page = hasMore ? rows.slice(0, limit) : rows;
      const nextCursor = hasMore ? page[page.length - 1].id : null;

      return reply.status(200).send({
        nextCursor,
        items: page.map(toEncryptedGlobalVaultItem),
      });
    });
}
