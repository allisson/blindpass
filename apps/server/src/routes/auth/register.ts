import { createHash } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { RegisterRequestSchema } from '@blindpass/api-schema';
import { b64 } from '../../utils/base64.js';
import { registerUser } from '../../auth/registration/service.js';
import { asTx } from '../../db/tx.js';
import { authRateLimit } from './rate-limit.js';
import { sendAuthFailure } from './result.js';

export function registerRegisterRoute(app: FastifyInstance): void {
  app.withTypeProvider<ZodTypeProvider>().post(
    '/auth/register',
    {
      schema: { body: RegisterRequestSchema },
      config: {
        rateLimit: {
          ...authRateLimit(5),
          keyGenerator: (req) => {
            const body = req.body as Record<string, unknown>;
            if (typeof body?.username === 'string') {
              return `username:${createHash('sha256').update(body.username).digest('hex')}`;
            }
            return req.ip;
          },
        },
      },
    },
    async (request, reply) => {
      const body = request.body;
      const result = await app.db.transaction(async (tx) =>
        registerUser(
          asTx(tx),
          {
            username: body.username,
            recoveryVerifier: body.recoveryVerifier,
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
            vault: {
              encryptedVaultKeyCiphertext: b64(body.encryptedVaultKey.ciphertext),
              encryptedVaultKeyNonce: b64(body.encryptedVaultKey.nonce),
              encryptedVaultDataCiphertext: b64(body.encryptedVaultData.ciphertext),
              encryptedVaultDataNonce: b64(body.encryptedVaultData.nonce),
            },
          },
          app.clock,
        ),
      );

      if (!result.ok) return sendAuthFailure(reply, result.reason);

      return reply.status(201).send({ enrollment: result.enrollment });
    },
  );
}
