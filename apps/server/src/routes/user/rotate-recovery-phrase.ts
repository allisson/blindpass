import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { eq } from 'drizzle-orm';
import { RotateRecoveryPhraseRequestSchema } from '@blindpass/api-schema';
import { users } from '../../db/schema.js';
import { b64 } from '../../utils/base64.js';
import { hashRecoveryVerifierInput } from '../auth/helpers.js';
import { verifyAuthenticatorForUser } from './verify-authenticator-for-user.js';

export function registerRotateRecoveryPhraseRoute(app: FastifyInstance): void {
  app.withTypeProvider<ZodTypeProvider>().put(
    '/user/recovery-phrase',
    {
      schema: { body: RotateRecoveryPhraseRequestSchema },
      config: { rateLimit: { max: 5, timeWindow: '15 minutes' } },
    },
    async (request, reply) => {
      const counter = await verifyAuthenticatorForUser(
        app.db,
        request.userId,
        request.body.authenticatorCode,
      );
      if (counter == null) {
        return reply.status(400).send({ error: 'Invalid authenticator code' });
      }

      const verifier = hashRecoveryVerifierInput(request.body.recoveryVerifier);
      await app.db
        .update(users)
        .set({
          publicKey: b64(request.body.publicKey),
          encryptedMasterKeyForRecoveryCiphertext: b64(
            request.body.encryptedMasterKeyForRecovery.ciphertext,
          ),
          encryptedMasterKeyForRecoveryNonce: b64(request.body.encryptedMasterKeyForRecovery.nonce),
          encryptedPrivateKeyCiphertext: b64(request.body.encryptedPrivateKey.ciphertext),
          encryptedPrivateKeyNonce: b64(request.body.encryptedPrivateKey.nonce),
          encryptedRecoveryKeyCiphertext: b64(request.body.encryptedRecoveryKey.ciphertext),
          encryptedRecoveryKeyNonce: b64(request.body.encryptedRecoveryKey.nonce),
          recoveryVerifierHash: verifier.hash,
          recoveryVerifierSalt: verifier.salt,
          totpLastUsedCounter: counter,
          updatedAt: new Date(),
        })
        .where(eq(users.id, request.userId));

      return reply.status(200).send({ message: 'Recovery phrase rotated' });
    },
  );
}
