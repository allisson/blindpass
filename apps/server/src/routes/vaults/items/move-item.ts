import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { and, eq, isNull } from 'drizzle-orm';
import { MoveItemRequestSchema, VaultItemParamSchema } from '@blindpass/api-schema';
import { vaultFolders, vaultItems } from '../../../db/schema.js';
import { getVaultAccess } from '../vault-access.js';

export function registerMoveItemRoute(app: FastifyInstance): void {
  app.withTypeProvider<ZodTypeProvider>().patch(
    '/vaults/:vaultId/items/:id/folder',
    {
      schema: { params: VaultItemParamSchema, body: MoveItemRequestSchema },
    },
    async (request, reply) => {
      const { vaultId, id } = request.params;
      const { folderId } = request.body;

      const access = await getVaultAccess(app, vaultId, request.userId);
      if (!access) return reply.status(404).send({ error: 'Vault not found' });
      if (access.role === 'viewer') return reply.status(403).send({ error: 'Forbidden' });

      if (folderId) {
        const [folder] = await app.db
          .select({ id: vaultFolders.id })
          .from(vaultFolders)
          .where(and(eq(vaultFolders.id, folderId), eq(vaultFolders.vaultId, vaultId)))
          .limit(1);
        if (!folder) return reply.status(404).send({ error: 'Folder not found' });
      }

      const [item] = await app.db
        .update(vaultItems)
        .set({ folderId, updatedAt: new Date() })
        .where(
          and(eq(vaultItems.id, id), eq(vaultItems.vaultId, vaultId), isNull(vaultItems.deletedAt)),
        )
        .returning({ id: vaultItems.id });

      if (!item) return reply.status(404).send({ error: 'Item not found' });

      return reply.status(204).send();
    },
  );
}
