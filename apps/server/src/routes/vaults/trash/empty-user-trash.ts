import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { and, eq, inArray, isNotNull } from 'drizzle-orm';
import { vaults, vaultItems } from '../../../db/schema.js';

export function registerEmptyUserTrashRoute(app: FastifyInstance): void {
  app.withTypeProvider<ZodTypeProvider>().delete('/user/trash', {}, async (request, reply) => {
    const userVaults = await app.db
      .select({ id: vaults.id })
      .from(vaults)
      .where(eq(vaults.userId, request.userId));

    if (userVaults.length > 0) {
      const vaultIds = userVaults.map((v) => v.id);
      await app.db
        .delete(vaultItems)
        .where(and(inArray(vaultItems.vaultId, vaultIds), isNotNull(vaultItems.deletedAt)));
    }

    return reply.status(204).send();
  });
}
