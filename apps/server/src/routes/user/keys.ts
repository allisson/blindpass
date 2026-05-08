import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { UpdateKeysRequestSchema } from '@blindpass/api-schema';
import { b64 } from '../../utils/base64.js';
import { fromUserRow } from '../../auth/bundle/from-user-row.js';
import { findFullById, updateKeyBundle } from '../../auth/users/repository.js';

export const USER_KEYS_GET_RATE_LIMIT_MAX = 120;

export function registerUserKeysRoute(app: FastifyInstance): void {
  app.get(
    '/user/keys',
    { config: { rateLimit: { max: USER_KEYS_GET_RATE_LIMIT_MAX, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const user = await findFullById(app.db, request.userId);
      if (!user || !user.kekSalt) {
        return reply.status(404).send({ error: 'Keys not found' });
      }
      return reply.status(200).send(fromUserRow(user));
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
      await updateKeyBundle(app.db, request.userId, {
        kekSalt: b64(body.kekSalt),
        publicKey: b64(body.publicKey),
        encryptedMasterKeyCiphertext: b64(body.encryptedMasterKey.ciphertext),
        encryptedMasterKeyNonce: b64(body.encryptedMasterKey.nonce),
        encryptedMasterKeyForRecoveryCiphertext: b64(body.encryptedMasterKeyForRecovery.ciphertext),
        encryptedMasterKeyForRecoveryNonce: b64(body.encryptedMasterKeyForRecovery.nonce),
        encryptedPrivateKeyCiphertext: b64(body.encryptedPrivateKey.ciphertext),
        encryptedPrivateKeyNonce: b64(body.encryptedPrivateKey.nonce),
        encryptedRecoveryKeyCiphertext: b64(body.encryptedRecoveryKey.ciphertext),
        encryptedRecoveryKeyNonce: b64(body.encryptedRecoveryKey.nonce),
      });
      return reply.status(200).send({ message: 'Keys updated' });
    },
  );
}
