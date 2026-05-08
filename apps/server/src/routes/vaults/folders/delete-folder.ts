import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { FolderParamSchema } from '@blindpass/api-schema';
import { getVaultAccess } from '../../../vaults/access.js';
import * as folders from '../../../vaults/folders/repository.js';

export function registerDeleteFolderRoute(app: FastifyInstance): void {
  app
    .withTypeProvider<ZodTypeProvider>()
    .delete(
      '/vaults/:vaultId/folders/:folderId',
      { schema: { params: FolderParamSchema } },
      async (request, reply) => {
        const { vaultId, folderId } = request.params;

        const access = await getVaultAccess(app.db, vaultId, request.userId);
        if (!access) return reply.status(404).send({ error: 'Vault not found' });
        if (access.role === 'viewer') return reply.status(403).send({ error: 'Forbidden' });

        const deleted = await folders.deleteById(app.db, folderId, vaultId);
        if (!deleted) return reply.status(404).send({ error: 'Folder not found' });

        return reply.status(204).send();
      },
    );
}
