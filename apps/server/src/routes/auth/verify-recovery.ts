import { randomBytes } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { eq } from 'drizzle-orm';
import { VerifyRecoveryRequestSchema } from '@blindpass/api-schema';
import { pendingTotpEnrollments, recoveryTokens, users } from '../../db/schema.js';
import { hashToken } from '../../utils/otp.js';
import { buildAuthBundle, createTotpEnrollment, verifyRecoveryVerifierInput } from './helpers.js';
import { env } from '../../env.js';
import { authRateLimit } from './rate-limit.js';

export function registerVerifyRecoveryRoute(app: FastifyInstance): void {
  app.withTypeProvider<ZodTypeProvider>().post(
    '/auth/recovery/verify',
    {
      schema: { body: VerifyRecoveryRequestSchema },
      config: { rateLimit: authRateLimit(5) },
    },
    async (request, reply) => {
      const [user] = await app.db
        .select()
        .from(users)
        .where(eq(users.username, request.body.username))
        .limit(1);
      if (
        !user ||
        !user.verified ||
        user.revokedAt ||
        !verifyRecoveryVerifierInput(
          request.body.recoveryVerifier,
          user.recoveryVerifierHash,
          user.recoveryVerifierSalt,
        ) ||
        !user.publicKey ||
        !user.kekSalt
      ) {
        return reply.status(400).send({ error: 'Invalid recovery credentials' });
      }

      const recoveryToken = randomBytes(32).toString('hex');
      const recoveryExpiry = new Date(Date.now() + env.RECOVERY_TOKEN_TTL_MS);
      const enrollmentExpiry = new Date(Date.now() + env.PENDING_TOTP_TTL_MS);
      const enrollment = createTotpEnrollment(user.username, enrollmentExpiry);
      let enrollmentId = '';

      await app.db.transaction(async (tx) => {
        await tx.delete(recoveryTokens).where(eq(recoveryTokens.userId, user.id));
        await tx.delete(pendingTotpEnrollments).where(eq(pendingTotpEnrollments.userId, user.id));
        const [pending] = await tx
          .insert(pendingTotpEnrollments)
          .values({
            userId: user.id,
            encryptedSecret: enrollment.encryptedSecret,
            expiresAt: enrollmentExpiry,
          })
          .returning({ id: pendingTotpEnrollments.id });
        enrollmentId = pending.id;
        await tx.insert(recoveryTokens).values({
          userId: user.id,
          tokenHash: hashToken(recoveryToken),
          expiresAt: recoveryExpiry,
        });
      });

      return reply.status(200).send({
        recoveryToken,
        enrollment: {
          enrollmentId,
          setupKey: enrollment.secret,
          otpauthUri: enrollment.otpauthUri,
          expiresAt: enrollment.expiresAt,
        },
        bundle: buildAuthBundle(user),
      });
    },
  );
}
