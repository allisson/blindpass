import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { VersionParamSchema } from '@blindpass/api-schema';
import { toB64 } from '../../../utils/base64.js';
import { getVaultAccess } from '../../../vaults/access.js';
import * as versions from '../../../vaults/versions/repository.js';

export function registerGetVersionRoute(app: FastifyInstance): void {
  app
    .withTypeProvider<ZodTypeProvider>()
    .get(
      '/vaults/:vaultId/items/:id/versions/:versionId',
      { schema: { params: VersionParamSchema } },
      async (request, reply) => {
        const { vaultId, id, versionId } = request.params;

        const access = await getVaultAccess(app.db, vaultId, request.userId);
        if (!access) return reply.status(404).send({ error: 'Vault not found' });

        const item = await versions.findItemInVault(app.db, id, vaultId);
        if (!item) return reply.status(404).send({ error: 'Item not found' });

        const version = await versions.findById(app.db, versionId, id);
        if (!version) return reply.status(404).send({ error: 'Version not found' });

        return reply.status(200).send({
          version: {
            id: version.id,
            versionNum: version.versionNum,
            encryptedData: {
              ciphertext: toB64(version.encryptedDataCiphertext),
              nonce: toB64(version.encryptedDataNonce),
            },
            encryptedItemKey: {
              ciphertext: toB64(version.encryptedItemKeyCiphertext),
              nonce: toB64(version.encryptedItemKeyNonce),
            },
            createdAt: version.createdAt.toISOString(),
          },
        });
      },
    );
}
