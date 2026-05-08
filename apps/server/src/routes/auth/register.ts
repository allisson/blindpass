import { createHash } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { RegisterRequestSchema } from '@blindpass/api-schema';
import { b64 } from '../../utils/base64.js';
import { registerUser, type RegisterUserResult } from '../../auth/registration/service.js';
import { authRateLimit } from './rate-limit.js';

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
      let result: RegisterUserResult;
      try {
        result = await app.db.transaction(async (tx) =>
          registerUser(tx, {
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
          }),
        );
      } catch (err: unknown) {
        const code =
          (err as { code?: string }).code ?? (err as { cause?: { code?: string } }).cause?.code;
        if (code === '23505') {
          return reply.status(409).send({ error: 'Conflict' });
        }
        throw err;
      }

      if (!result.ok) {
        if (result.reason === 'registrations_disabled') {
          return reply.status(403).send({ error: 'registrations_disabled' });
        }
        return reply.status(409).send({ error: 'Conflict' });
      }

      return reply.status(201).send({ enrollment: result.enrollment });
    },
  );
}
