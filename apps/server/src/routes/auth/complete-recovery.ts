import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { and, eq, gt } from 'drizzle-orm';
import { CompleteRecoveryRequestSchema } from '@blindpass/api-schema';
import {
  pendingTotpEnrollments,
  recoveryTokens,
  sessions,
  userTotpSecrets,
  users,
} from '../../db/schema.js';
import { b64 } from '../../utils/base64.js';
import { hashToken } from '../../utils/otp.js';
import {
  buildAuthBundle,
  decryptTotpSecret,
  hashRecoveryVerifierInput,
  insertSessionValues,
  issueSessionToken,
  setAuthCookie,
  verifyTotpCode,
} from './helpers.js';
import { authRateLimit } from './rate-limit.js';

export function registerCompleteRecoveryRoute(app: FastifyInstance): void {
  app.withTypeProvider<ZodTypeProvider>().post(
    '/auth/recovery/complete',
    {
      schema: { body: CompleteRecoveryRequestSchema },
      config: { rateLimit: authRateLimit(5) },
    },
    async (request, reply) => {
      const {
        username,
        recoveryToken,
        enrollmentId,
        authenticatorCode,
        recoveryVerifier,
        ...keys
      } = request.body;
      const [user] = await app.db.select().from(users).where(eq(users.username, username)).limit(1);
      if (!user || user.revokedAt) {
        return reply.status(400).send({ error: 'Invalid recovery completion' });
      }

      const [token] = await app.db
        .select()
        .from(recoveryTokens)
        .where(
          and(
            eq(recoveryTokens.userId, user.id),
            eq(recoveryTokens.tokenHash, hashToken(recoveryToken)),
            gt(recoveryTokens.expiresAt, new Date()),
          ),
        )
        .limit(1);
      if (!token) {
        return reply.status(400).send({ error: 'Invalid recovery completion' });
      }

      const [enrollment] = await app.db
        .select()
        .from(pendingTotpEnrollments)
        .where(
          and(
            eq(pendingTotpEnrollments.id, enrollmentId),
            eq(pendingTotpEnrollments.userId, user.id),
            gt(pendingTotpEnrollments.expiresAt, new Date()),
          ),
        )
        .limit(1);
      if (!enrollment) {
        return reply.status(400).send({ error: 'Invalid recovery completion' });
      }

      const counter = verifyTotpCode(
        decryptTotpSecret(enrollment.encryptedSecret),
        authenticatorCode,
        null,
      );
      if (counter == null) {
        return reply.status(400).send({ error: 'Invalid recovery completion' });
      }

      const nextRecovery = hashRecoveryVerifierInput(recoveryVerifier);
      const authToken = issueSessionToken();
      let fullUser: typeof users.$inferSelect | undefined;

      await app.db.transaction(async (tx) => {
        await tx.delete(sessions).where(eq(sessions.userId, user.id));
        await tx.delete(recoveryTokens).where(eq(recoveryTokens.userId, user.id));
        await tx.delete(pendingTotpEnrollments).where(eq(pendingTotpEnrollments.userId, user.id));
        await tx.delete(userTotpSecrets).where(eq(userTotpSecrets.userId, user.id));
        await tx.insert(userTotpSecrets).values({
          userId: user.id,
          encryptedSecret: enrollment.encryptedSecret,
        });
        await tx
          .update(users)
          .set({
            verified: true,
            kekSalt: b64(keys.kekSalt),
            publicKey: b64(keys.publicKey),
            encryptedMasterKeyCiphertext: b64(keys.encryptedMasterKey.ciphertext),
            encryptedMasterKeyNonce: b64(keys.encryptedMasterKey.nonce),
            encryptedMasterKeyForRecoveryCiphertext: b64(
              keys.encryptedMasterKeyForRecovery.ciphertext,
            ),
            encryptedMasterKeyForRecoveryNonce: b64(keys.encryptedMasterKeyForRecovery.nonce),
            encryptedPrivateKeyCiphertext: b64(keys.encryptedPrivateKey.ciphertext),
            encryptedPrivateKeyNonce: b64(keys.encryptedPrivateKey.nonce),
            encryptedRecoveryKeyCiphertext: b64(keys.encryptedRecoveryKey.ciphertext),
            encryptedRecoveryKeyNonce: b64(keys.encryptedRecoveryKey.nonce),
            recoveryVerifierHash: nextRecovery.hash,
            recoveryVerifierSalt: nextRecovery.salt,
            totpLastUsedCounter: counter,
            updatedAt: new Date(),
          })
          .where(eq(users.id, user.id));
        await tx
          .insert(sessions)
          .values(insertSessionValues(user.id, authToken, request.headers['user-agent']));
        [fullUser] = await tx.select().from(users).where(eq(users.id, user.id)).limit(1);
      });

      if (!fullUser?.publicKey || !fullUser.kekSalt) {
        return reply.status(400).send({ error: 'Account not fully provisioned' });
      }

      setAuthCookie(reply, authToken);
      return reply.status(200).send(buildAuthBundle(fullUser));
    },
  );
}
