import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { RotateRecoveryPhraseRequestSchema } from '@blindpass/api-schema';
import { b64 } from '../../utils/base64.js';
import { rotateRecoveryPhrase } from '../../auth/account/service.js';
import { asTx } from '../../db/tx.js';

export function registerRotateRecoveryPhraseRoute(app: FastifyInstance): void {
  app.withTypeProvider<ZodTypeProvider>().put(
    '/user/recovery-phrase',
    {
      schema: { body: RotateRecoveryPhraseRequestSchema },
      config: { rateLimit: { max: 5, timeWindow: '15 minutes' } },
    },
    async (request, reply) => {
      const body = request.body;
      const result = await app.db.transaction(async (tx) =>
        rotateRecoveryPhrase(
          asTx(tx),
          request.userId,
          {
            authenticatorCode: body.authenticatorCode,
            recoveryVerifier: body.recoveryVerifier,
            publicKey: b64(body.publicKey),
            encryptedMasterKeyForRecoveryCiphertext: b64(
              body.encryptedMasterKeyForRecovery.ciphertext,
            ),
            encryptedMasterKeyForRecoveryNonce: b64(body.encryptedMasterKeyForRecovery.nonce),
            encryptedPrivateKeyCiphertext: b64(body.encryptedPrivateKey.ciphertext),
            encryptedPrivateKeyNonce: b64(body.encryptedPrivateKey.nonce),
            encryptedRecoveryKeyCiphertext: b64(body.encryptedRecoveryKey.ciphertext),
            encryptedRecoveryKeyNonce: b64(body.encryptedRecoveryKey.nonce),
          },
          app.clock,
        ),
      );

      if (!result.ok) {
        return reply.status(400).send({ error: 'Invalid authenticator code' });
      }

      return reply.status(200).send({ message: 'Recovery phrase rotated' });
    },
  );
}
