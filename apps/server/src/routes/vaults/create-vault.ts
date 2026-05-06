import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { CreateVaultRequestSchema } from '@blindpass/api-schema';
import { vaults } from '../../db/schema.js';
import { assertVaultQuota, getEffectiveOwnerQuota } from '../../services/quota.js';
import { b64, toB64 } from '../../utils/base64.js';

export function registerCreateVaultRoute(app: FastifyInstance): void {
  app.withTypeProvider<ZodTypeProvider>().post(
    '/vaults',
    {
      schema: { body: CreateVaultRequestSchema },
    },
    async (request, reply) => {
      const body = request.body;

      const vault = await app.db.transaction(async (tx) => {
        const limit = await getEffectiveOwnerQuota(tx, request.userId);
        await assertVaultQuota(tx, request.userId, limit);
        const [row] = await tx
          .insert(vaults)
          .values({
            userId: request.userId,
            encryptedVaultKeyCiphertext: b64(body.encryptedVaultKey.ciphertext),
            encryptedVaultKeyNonce: b64(body.encryptedVaultKey.nonce),
            encryptedVaultDataCiphertext: b64(body.encryptedVaultData.ciphertext),
            encryptedVaultDataNonce: b64(body.encryptedVaultData.nonce),
          })
          .returning();
        return row;
      });

      return reply.status(201).send({
        vault: {
          id: vault.id,
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
