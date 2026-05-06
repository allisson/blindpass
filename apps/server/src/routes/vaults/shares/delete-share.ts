import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { and, eq, or } from 'drizzle-orm';
import { ShareParamSchema } from '@blindpass/api-schema';
import { vaultShares } from '../../../db/schema.js';

export function registerDeleteShareRoute(app: FastifyInstance): void {
  app.withTypeProvider<ZodTypeProvider>().delete(
    '/vaults/:vaultId/shares/:shareId',
    {
      schema: { params: ShareParamSchema },
    },
    async (request, reply) => {
      const { vaultId, shareId } = request.params;

      const [share] = await app.db
        .select({
          id: vaultShares.id,
          ownerUserId: vaultShares.ownerUserId,
          receiverUserId: vaultShares.receiverUserId,
        })
        .from(vaultShares)
        .where(
          and(
            eq(vaultShares.id, shareId),
            eq(vaultShares.vaultId, vaultId),
            or(
              eq(vaultShares.ownerUserId, request.userId),
              eq(vaultShares.receiverUserId, request.userId),
            ),
          ),
        )
        .limit(1);

      if (!share) return reply.status(404).send({ error: 'Share not found' });

      await app.db.delete(vaultShares).where(eq(vaultShares.id, shareId));

      request.log.info({ event: 'share_revoked', vaultId, shareId }, 'Share revoked');

      return reply.status(204).send();
    },
  );
}
