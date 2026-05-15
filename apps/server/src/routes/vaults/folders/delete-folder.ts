import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { FolderParamSchema } from '@blindpass/api-schema';
import { deleteFolder } from '../../../vaults/folders/service.js';
import { asTx } from '../../../db/tx.js';

export function registerDeleteFolderRoute(app: FastifyInstance): void {
  app
    .withTypeProvider<ZodTypeProvider>()
    .delete(
      '/vaults/:vaultId/folders/:folderId',
      { schema: { params: FolderParamSchema } },
      async (request, reply) => {
        const { vaultId, folderId } = request.params;

        const result = await app.db.transaction(async (tx) =>
          deleteFolder(asTx(tx), request.userId, vaultId, folderId),
        );

        if (!result.ok) {
          if (result.reason === 'forbidden') return reply.status(403).send({ error: 'Forbidden' });
          if (result.reason === 'folder_not_found')
            return reply.status(404).send({ error: 'Folder not found' });
          return reply.status(404).send({ error: 'Vault not found' });
        }

        return reply.status(204).send();
      },
    );
}
