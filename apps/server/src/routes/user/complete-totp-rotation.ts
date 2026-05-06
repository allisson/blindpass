import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { and, eq, gt } from 'drizzle-orm';
import { CompleteTotpRotationRequestSchema } from '@blindpass/api-schema';
import { pendingTotpEnrollments, sessions, userTotpSecrets, users } from '../../db/schema.js';
import { decryptTotpSecret, verifyTotpCode } from '../auth/helpers.js';

export function registerCompleteTotpRotationRoute(app: FastifyInstance): void {
  app.withTypeProvider<ZodTypeProvider>().post(
    '/user/totp/rotate/complete',
    {
      schema: { body: CompleteTotpRotationRequestSchema },
      config: { rateLimit: { max: 5, timeWindow: '15 minutes' } },
    },
    async (request, reply) => {
      const [user] = await app.db
        .select({ lastUsedCounter: users.totpLastUsedCounter })
        .from(users)
        .where(eq(users.id, request.userId))
        .limit(1);
      if (!user) {
        return reply.status(404).send({ error: 'Not found' });
      }

      const [enrollment] = await app.db
        .select()
        .from(pendingTotpEnrollments)
        .where(
          and(
            eq(pendingTotpEnrollments.id, request.body.enrollmentId),
            eq(pendingTotpEnrollments.userId, request.userId),
            gt(pendingTotpEnrollments.expiresAt, new Date()),
          ),
        )
        .limit(1);
      if (!enrollment) {
        return reply.status(400).send({ error: 'Invalid or expired enrollment' });
      }

      const counter = verifyTotpCode(
        decryptTotpSecret(enrollment.encryptedSecret),
        request.body.authenticatorCode,
        user.lastUsedCounter,
      );
      if (counter == null) {
        return reply.status(400).send({ error: 'Invalid or expired enrollment' });
      }

      await app.db.transaction(async (tx) => {
        await tx.delete(userTotpSecrets).where(eq(userTotpSecrets.userId, request.userId));
        await tx.insert(userTotpSecrets).values({
          userId: request.userId,
          encryptedSecret: enrollment.encryptedSecret,
        });
        await tx
          .delete(pendingTotpEnrollments)
          .where(eq(pendingTotpEnrollments.userId, request.userId));
        await tx.delete(sessions).where(eq(sessions.userId, request.userId));
        await tx
          .update(users)
          .set({ totpLastUsedCounter: counter, updatedAt: new Date() })
          .where(eq(users.id, request.userId));
      });

      return reply.status(200).send({ message: 'Authenticator rotated' });
    },
  );
}
