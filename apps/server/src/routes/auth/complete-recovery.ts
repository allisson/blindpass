import type { FastifyInstance } from 'fastify';
import { CompleteRecoveryRequestSchema } from '@blindpass/api-schema';
import { b64 } from '../../utils/base64.js';
import { completeRecovery } from '../../auth/recovery/service.js';
import { registerCompleteAuthRoute } from './complete-route.js';

export function registerCompleteRecoveryRoute(app: FastifyInstance): void {
  registerCompleteAuthRoute(app, {
    path: '/auth/recovery/complete',
    schema: CompleteRecoveryRequestSchema,
    rateLimit: 5,
    run: async (tx, request, clock) => {
      const body = request.body;
      const r = await completeRecovery(
        tx,
        {
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
        },
        clock,
      );
      return r.ok ? { ok: true, proof: r.proof, payload: r.bundle } : r;
    },
  });
}
