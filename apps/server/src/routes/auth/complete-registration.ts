import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { and, eq, gt } from 'drizzle-orm';
import { CompleteRegistrationRequestSchema } from '@blindpass/api-schema';
import { pendingTotpEnrollments, sessions, userTotpSecrets, users } from '../../db/schema.js';
import {
  buildAuthBundle,
  decryptTotpSecret,
  insertSessionValues,
  issueSessionToken,
  setAuthCookie,
  verifyTotpCode,
} from './helpers.js';
import { authRateLimit } from './rate-limit.js';

export function registerCompleteRegistrationRoute(app: FastifyInstance): void {
  app.withTypeProvider<ZodTypeProvider>().post(
    '/auth/register/complete',
    {
      schema: { body: CompleteRegistrationRequestSchema },
      config: { rateLimit: authRateLimit(10) },
    },
    async (request, reply) => {
      const { username, enrollmentId, authenticatorCode } = request.body;
      const [user] = await app.db.select().from(users).where(eq(users.username, username)).limit(1);

      if (!user || user.revokedAt || user.verified) {
        return reply.status(400).send({ error: 'Invalid or expired enrollment' });
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
        return reply.status(400).send({ error: 'Invalid or expired enrollment' });
      }

      const counter = verifyTotpCode(
        decryptTotpSecret(enrollment.encryptedSecret),
        authenticatorCode,
        user.totpLastUsedCounter,
      );
      if (counter == null) {
        const attempts = enrollment.attempts + 1;
        await app.db
          .update(pendingTotpEnrollments)
          .set({ attempts, updatedAt: new Date() })
          .where(eq(pendingTotpEnrollments.id, enrollment.id));
        if (attempts >= 3) {
          await app.db
            .delete(pendingTotpEnrollments)
            .where(eq(pendingTotpEnrollments.id, enrollment.id));
        }
        return reply.status(400).send({ error: 'Invalid or expired enrollment' });
      }

      const authToken = issueSessionToken();
      let fullUser: typeof users.$inferSelect | undefined;
      await app.db.transaction(async (tx) => {
        await tx.delete(userTotpSecrets).where(eq(userTotpSecrets.userId, user.id));
        await tx.insert(userTotpSecrets).values({
          userId: user.id,
          encryptedSecret: enrollment.encryptedSecret,
        });
        await tx.delete(pendingTotpEnrollments).where(eq(pendingTotpEnrollments.userId, user.id));
        await tx
          .update(users)
          .set({ verified: true, totpLastUsedCounter: counter, updatedAt: new Date() })
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
