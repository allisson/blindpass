import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { ChangePasswordRequestSchema } from '@blindpass/api-schema';
import { b64 } from '../../utils/base64.js';
import { changePassword } from '../../auth/account/service.js';
import { asTx } from '../../db/tx.js';

export function registerChangePasswordRoute(app: FastifyInstance): void {
  app.withTypeProvider<ZodTypeProvider>().put(
    '/user/password',
    {
      schema: { body: ChangePasswordRequestSchema },
      config: { rateLimit: { max: 3, timeWindow: '15 minutes' } },
    },
    async (request, reply) => {
      const { authenticatorCode, kekSalt, encryptedMasterKey } = request.body;

      const result = await app.db.transaction(async (tx) =>
        changePassword(
          asTx(tx),
          request.userId,
          {
            authenticatorCode,
            kekSalt: b64(kekSalt),
            encryptedMasterKeyCiphertext: b64(encryptedMasterKey.ciphertext),
            encryptedMasterKeyNonce: b64(encryptedMasterKey.nonce),
          },
          app.clock,
        ),
      );

      if (!result.ok) {
        return reply.status(400).send({ error: 'Invalid authenticator code' });
      }

      return reply.status(200).send({ message: 'Password changed' });
    },
  );
}
