import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { CreateShareRequestSchema, VaultIdParamSchema } from '@blindpass/api-schema';
import { b64 } from '../../../utils/base64.js';
import { createShare } from '../../../vaults/shares/service.js';
import { asTx } from '../../../db/tx.js';
import { sendVaultFailure } from '../result.js';

export function registerCreateShareRoute(app: FastifyInstance): void {
  app
    .withTypeProvider<ZodTypeProvider>()
    .post(
      '/vaults/:vaultId/shares',
      { schema: { params: VaultIdParamSchema, body: CreateShareRequestSchema } },
      async (request, reply) => {
        const { vaultId } = request.params;
        const { receiverUserId, sealedVaultKey, role } = request.body;

        // PG 23505 (duplicate share) bubbles to the global error handler,
        // which maps it to 409 Conflict. Same pattern as register.ts.
        const result = await app.db.transaction(async (tx) =>
          createShare(asTx(tx), request.userId, vaultId, {
            receiverUserId,
            sealedVaultKey: b64(sealedVaultKey),
            role: role ?? 'viewer',
          }),
        );

        if (!result.ok)
          return sendVaultFailure(reply, result.reason, {
            cannot_share_with_self: [400, 'cannot_share_with_self'],
            receiver_not_found: [404, 'Receiver not found'],
          });

        request.log.info(
          { event: 'vault_shared', vaultId, receiverUserId, role: result.share.role },
          'Vault shared',
        );

        return reply.status(201).send({
          share: {
            id: result.share.id,
            receiverUserId: result.share.receiverUserId,
            receiverUsername: result.share.receiverUsername,
            role: result.share.role,
            createdAt: result.share.createdAt.toISOString(),
          },
        });
      },
    );
}
