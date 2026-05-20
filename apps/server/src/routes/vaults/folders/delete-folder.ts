import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { FolderParamSchema } from '@blindpass/api-schema';
import { deleteFolder } from '../../../vaults/folders/service.js';
import { asTx } from '../../../db/tx.js';
import { sendVaultFailure } from '../result.js';

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

        if (!result.ok)
          return sendVaultFailure(reply, result.reason, {
            folder_not_found: [404, 'Folder not found'],
          });

        return reply.status(204).send();
      },
    );
}
