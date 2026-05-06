import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { eq } from 'drizzle-orm';
import { UpdateKeysRequestSchema } from '@blindpass/api-schema';
import { users } from '../../db/schema.js';
import { b64, toB64 } from '../../utils/base64.js';

export function registerUserKeysRoute(app: FastifyInstance): void {
  app.get(
    '/user/keys',
    { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const [user] = await app.db.select().from(users).where(eq(users.id, request.userId)).limit(1);

      if (!user || !user.kekSalt) {
        return reply.status(404).send({ error: 'Keys not found' });
      }

      return reply.status(200).send({
        kekSalt: toB64(user.kekSalt),
        publicKey: toB64(user.publicKey),
        encryptedMasterKey: {
          ciphertext: toB64(user.encryptedMasterKeyCiphertext),
          nonce: toB64(user.encryptedMasterKeyNonce),
        },
        encryptedMasterKeyForRecovery: {
          ciphertext: toB64(user.encryptedMasterKeyForRecoveryCiphertext),
          nonce: toB64(user.encryptedMasterKeyForRecoveryNonce),
        },
        encryptedPrivateKey: {
          ciphertext: toB64(user.encryptedPrivateKeyCiphertext),
          nonce: toB64(user.encryptedPrivateKeyNonce),
        },
        encryptedRecoveryKey: {
          ciphertext: toB64(user.encryptedRecoveryKeyCiphertext),
          nonce: toB64(user.encryptedRecoveryKeyNonce),
        },
      });
    },
  );

  app.withTypeProvider<ZodTypeProvider>().put(
    '/user/keys',
    {
      schema: { body: UpdateKeysRequestSchema },
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      const body = request.body;

      await app.db
        .update(users)
        .set({
          kekSalt: b64(body.kekSalt),
          publicKey: b64(body.publicKey),
          encryptedMasterKeyCiphertext: b64(body.encryptedMasterKey.ciphertext),
          encryptedMasterKeyNonce: b64(body.encryptedMasterKey.nonce),
          encryptedMasterKeyForRecoveryCiphertext: b64(
            body.encryptedMasterKeyForRecovery.ciphertext,
          ),
          encryptedMasterKeyForRecoveryNonce: b64(body.encryptedMasterKeyForRecovery.nonce),
          encryptedPrivateKeyCiphertext: b64(body.encryptedPrivateKey.ciphertext),
          encryptedPrivateKeyNonce: b64(body.encryptedPrivateKey.nonce),
          encryptedRecoveryKeyCiphertext: b64(body.encryptedRecoveryKey.ciphertext),
          encryptedRecoveryKeyNonce: b64(body.encryptedRecoveryKey.nonce),
          updatedAt: new Date(),
        })
        .where(eq(users.id, request.userId));

      return reply.status(200).send({ message: 'Keys updated' });
    },
  );
}
