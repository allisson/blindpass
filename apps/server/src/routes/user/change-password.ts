import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { eq } from 'drizzle-orm';
import { ChangePasswordRequestSchema } from '@blindpass/api-schema';
import { sessions, users } from '../../db/schema.js';
import { b64 } from '../../utils/base64.js';
import { verifyAuthenticatorForUser } from './verify-authenticator-for-user.js';

export function registerChangePasswordRoute(app: FastifyInstance): void {
  app.withTypeProvider<ZodTypeProvider>().put(
    '/user/password',
    {
      schema: { body: ChangePasswordRequestSchema },
      config: { rateLimit: { max: 3, timeWindow: '15 minutes' } },
    },
    async (request, reply) => {
      const { authenticatorCode, kekSalt, encryptedMasterKey } = request.body;

      const counter = await verifyAuthenticatorForUser(app.db, request.userId, authenticatorCode);
      if (counter == null) {
        return reply.status(400).send({ error: 'Invalid authenticator code' });
      }

      await app.db.transaction(async (tx) => {
        await tx
          .update(users)
          .set({
            kekSalt: b64(kekSalt),
            encryptedMasterKeyCiphertext: b64(encryptedMasterKey.ciphertext),
            encryptedMasterKeyNonce: b64(encryptedMasterKey.nonce),
            totpLastUsedCounter: counter,
            updatedAt: new Date(),
          })
          .where(eq(users.id, request.userId));
        await tx.delete(sessions).where(eq(sessions.userId, request.userId));
      });

      return reply.status(200).send({ message: 'Password changed' });
    },
  );
}
