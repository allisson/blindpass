import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { and, eq } from 'drizzle-orm';
import { FolderParamSchema } from '@blindpass/api-schema';
import { vaultFolders } from '../../../db/schema.js';
import { getVaultAccess } from '../vault-access.js';

export function registerDeleteFolderRoute(app: FastifyInstance): void {
  app.withTypeProvider<ZodTypeProvider>().delete(
    '/vaults/:vaultId/folders/:folderId',
    {
      schema: { params: FolderParamSchema },
    },
    async (request, reply) => {
      const { vaultId, folderId } = request.params;

      const access = await getVaultAccess(app, vaultId, request.userId);
      if (!access) return reply.status(404).send({ error: 'Vault not found' });
      if (access.role === 'viewer') return reply.status(403).send({ error: 'Forbidden' });

      const [deleted] = await app.db
        .delete(vaultFolders)
        .where(and(eq(vaultFolders.id, folderId), eq(vaultFolders.vaultId, vaultId)))
        .returning({ id: vaultFolders.id });

      if (!deleted) return reply.status(404).send({ error: 'Folder not found' });

      return reply.status(204).send();
    },
  );
}
