import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { CompleteRecoveryRequestSchema } from '@blindpass/api-schema';
import { b64 } from '../../utils/base64.js';
import * as session from '../../auth/session/index.js';
import { completeRecovery } from '../../auth/recovery/service.js';
import { authRateLimit } from './rate-limit.js';

export function registerCompleteRecoveryRoute(app: FastifyInstance): void {
  app.withTypeProvider<ZodTypeProvider>().post(
    '/auth/recovery/complete',
    {
      schema: { body: CompleteRecoveryRequestSchema },
      config: { rateLimit: authRateLimit(5) },
    },
    async (request, reply) => {
      const body = request.body;
      const result = await app.db.transaction(async (tx) =>
        completeRecovery(tx, {
          username: body.username,
          recoveryToken: body.recoveryToken,
          enrollmentId: body.enrollmentId,
          authenticatorCode: body.authenticatorCode,
          recoveryVerifier: body.recoveryVerifier,
          userAgent: request.headers['user-agent'],
          newKeys: {
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
          },
        }),
      );

      if (!result.ok) {
        const error =
          result.reason === 'not_provisioned'
            ? 'Account not fully provisioned'
            : 'Invalid recovery completion';
        return reply.status(400).send({ error });
      }

      session.attachCookie(reply, result.authToken);
      return reply.status(200).send(result.bundle);
    },
  );
}
