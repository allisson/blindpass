import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { eq } from 'drizzle-orm';
import { StartTotpRotationRequestSchema } from '@blindpass/api-schema';
import { pendingTotpEnrollments, users } from '../../db/schema.js';
import { env } from '../../env.js';
import { createTotpEnrollment } from '../auth/helpers.js';
import { verifyAuthenticatorForUser } from './verify-authenticator-for-user.js';

export function registerStartTotpRotationRoute(app: FastifyInstance): void {
  app.withTypeProvider<ZodTypeProvider>().post(
    '/user/totp/rotate/start',
    {
      schema: { body: StartTotpRotationRequestSchema },
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

      const [user] = await app.db
        .select({ username: users.username })
        .from(users)
        .where(eq(users.id, request.userId))
        .limit(1);
      if (!user) {
        return reply.status(404).send({ error: 'Not found' });
      }

      const expiresAt = new Date(Date.now() + env.PENDING_TOTP_TTL_MS);
      const enrollment = createTotpEnrollment(user.username, expiresAt);
      let enrollmentId = '';

      await app.db.transaction(async (tx) => {
        await tx
          .update(users)
          .set({ totpLastUsedCounter: counter, updatedAt: new Date() })
          .where(eq(users.id, request.userId));
        await tx
          .delete(pendingTotpEnrollments)
          .where(eq(pendingTotpEnrollments.userId, request.userId));
        const [pending] = await tx
          .insert(pendingTotpEnrollments)
          .values({
            userId: request.userId,
            encryptedSecret: enrollment.encryptedSecret,
            expiresAt,
          })
          .returning({ id: pendingTotpEnrollments.id });
        enrollmentId = pending.id;
      });

      return reply.status(200).send({
        enrollment: {
          enrollmentId,
          setupKey: enrollment.secret,
          otpauthUri: enrollment.otpauthUri,
          expiresAt: enrollment.expiresAt,
        },
      });
    },
  );
}
