import { createHash } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { eq, sql } from 'drizzle-orm';
import { RegisterRequestSchema } from '@blindpass/api-schema';
import { pendingTotpEnrollments, projectSettings, users, vaults } from '../../db/schema.js';
import { env } from '../../env.js';
import { b64 } from '../../utils/base64.js';
import {
  createTotpEnrollment,
  hashRecoveryVerifierInput,
  isUserStaleUnverified,
} from './helpers.js';
import { authRateLimit } from './rate-limit.js';

class RegistrationsDisabledError extends Error {
  constructor() {
    super('registrations_disabled');
    this.name = 'RegistrationsDisabledError';
  }
}

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
      const recoveryVerifier = hashRecoveryVerifierInput(body.recoveryVerifier);
      const enrollmentExpiry = new Date(Date.now() + env.PENDING_TOTP_TTL_MS);
      let enrollmentResponse:
        | { enrollmentId: string; setupKey: string; otpauthUri: string; expiresAt: string }
        | undefined;

      try {
        await app.db.transaction(async (tx) => {
          await tx.execute(sql`select pg_advisory_xact_lock(hashtext('admin_bootstrap')::bigint)`);
          const [settings] = await tx.select().from(projectSettings).limit(1);
          let bootstrapAdminUser = !settings;
          if (settings && !settings.registrationsEnabled) {
            throw new RegistrationsDisabledError();
          }

          const [existing] = await tx
            .select({ id: users.id, verified: users.verified, createdAt: users.createdAt })
            .from(users)
            .where(eq(users.username, body.username))
            .limit(1);
          if (existing) {
            if (!isUserStaleUnverified(existing)) {
              const conflict = new Error('username_taken') as Error & { code?: string };
              conflict.code = '23505';
              throw conflict;
            }
            if (settings?.adminUserId === existing.id) {
              await tx.delete(projectSettings).where(eq(projectSettings.id, 1));
              bootstrapAdminUser = true;
            }
            await tx.delete(users).where(eq(users.id, existing.id));
          }

          const [user] = await tx
            .insert(users)
            .values({
              username: body.username,
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
              recoveryVerifierHash: recoveryVerifier.hash,
              recoveryVerifierSalt: recoveryVerifier.salt,
            })
            .returning({ id: users.id });

          if (bootstrapAdminUser) {
            await tx.insert(projectSettings).values({ id: 1, adminUserId: user.id });
          }

          await tx.insert(vaults).values({
            userId: user.id,
            encryptedVaultKeyCiphertext: b64(body.encryptedVaultKey.ciphertext),
            encryptedVaultKeyNonce: b64(body.encryptedVaultKey.nonce),
            encryptedVaultDataCiphertext: b64(body.encryptedVaultData.ciphertext),
            encryptedVaultDataNonce: b64(body.encryptedVaultData.nonce),
          });

          const enrollment = createTotpEnrollment(body.username, enrollmentExpiry);
          const [pending] = await tx
            .insert(pendingTotpEnrollments)
            .values({
              userId: user.id,
              encryptedSecret: enrollment.encryptedSecret,
              expiresAt: enrollmentExpiry,
            })
            .returning({ id: pendingTotpEnrollments.id });
          enrollmentResponse = {
            enrollmentId: pending.id,
            setupKey: enrollment.secret,
            otpauthUri: enrollment.otpauthUri,
            expiresAt: enrollment.expiresAt,
          };
        });
      } catch (err: unknown) {
        const code =
          (err as { code?: string }).code ?? (err as { cause?: { code?: string } }).cause?.code;
        if (code === '23505') {
          return reply.status(409).send({ error: 'Conflict' });
        }
        if (err instanceof RegistrationsDisabledError) {
          return reply.status(403).send({ error: 'registrations_disabled' });
        }
        throw err;
      }

      if (!enrollmentResponse) {
        return reply.status(500).send({ error: 'internal_error' });
      }

      return reply.status(201).send({ enrollment: enrollmentResponse });
    },
  );
}
