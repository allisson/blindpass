import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { and, eq } from 'drizzle-orm';
import { UpdateVaultRequestSchema, VaultIdParamSchema } from '@blindpass/api-schema';
import { vaults } from '../../db/schema.js';
import { getVaultAccess } from './vault-access.js';
import { b64, toB64 } from '../../utils/base64.js';

export function registerUpdateVaultRoute(app: FastifyInstance): void {
  app.withTypeProvider<ZodTypeProvider>().put(
    '/vaults/:vaultId',
    {
      schema: { params: VaultIdParamSchema, body: UpdateVaultRequestSchema },
    },
    async (request, reply) => {
      const { vaultId } = request.params;
      const body = request.body;

      const access = await getVaultAccess(app, vaultId, request.userId);
      if (!access) return reply.status(404).send({ error: 'Vault not found' });
      if (access.role !== 'owner') return reply.status(403).send({ error: 'Forbidden' });

      const [vault] = await app.db
        .update(vaults)
        .set({
          encryptedVaultDataCiphertext: b64(body.encryptedVaultData.ciphertext),
          encryptedVaultDataNonce: b64(body.encryptedVaultData.nonce),
          updatedAt: new Date(),
        })
        .where(and(eq(vaults.id, vaultId), eq(vaults.userId, request.userId)))
        .returning();

      if (!vault) return reply.status(404).send({ error: 'Vault not found' });

      return reply.status(200).send({
        vault: {
          id: vault.id,
          isShared: false as const,
          encryptedVaultKey: {
            ciphertext: toB64(vault.encryptedVaultKeyCiphertext),
            nonce: toB64(vault.encryptedVaultKeyNonce),
          },
          encryptedVaultData: {
            ciphertext: toB64(vault.encryptedVaultDataCiphertext),
            nonce: toB64(vault.encryptedVaultDataNonce),
          },
          createdAt: vault.createdAt.toISOString(),
          updatedAt: vault.updatedAt.toISOString(),
        },
      });
    },
  );
}
