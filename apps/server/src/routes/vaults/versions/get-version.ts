import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { and, eq } from 'drizzle-orm';
import { VersionParamSchema } from '@blindpass/api-schema';
import { vaultItems, vaultItemVersions } from '../../../db/schema.js';
import { getVaultAccess } from '../vault-access.js';
import { toB64 } from '../../../utils/base64.js';

export function registerGetVersionRoute(app: FastifyInstance): void {
  app.withTypeProvider<ZodTypeProvider>().get(
    '/vaults/:vaultId/items/:id/versions/:versionId',
    {
      schema: { params: VersionParamSchema },
    },
    async (request, reply) => {
      const { vaultId, id, versionId } = request.params;

      const access = await getVaultAccess(app, vaultId, request.userId);
      if (!access) return reply.status(404).send({ error: 'Vault not found' });

      const [item] = await app.db
        .select({ id: vaultItems.id })
        .from(vaultItems)
        .where(and(eq(vaultItems.id, id), eq(vaultItems.vaultId, vaultId)))
        .limit(1);

      if (!item) return reply.status(404).send({ error: 'Item not found' });

      const [version] = await app.db
        .select()
        .from(vaultItemVersions)
        .where(and(eq(vaultItemVersions.id, versionId), eq(vaultItemVersions.itemId, id)))
        .limit(1);

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
