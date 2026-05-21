import type { TotpEnrollment } from '@blindpass/api-schema';
import type { TxDb } from '../../db/tx.js';
import type { Clock } from '../../plugins/clock.js';
import { env } from '../../env.js';
import * as totp from '../totp/index.js';
import { verifyAuthenticatorForUser } from '../totp/verify-for-user.js';
import * as users from '../users/repository.js';
import * as enrollments from '../enrollments/repository.js';
import * as totpSecrets from '../totp-secrets/repository.js';
import * as sessions from '../sessions/repository.js';

type Db = TxDb;

export type StartRotationInput = {
  authenticatorCode: string;
};

export type StartRotationFailure = 'invalid_authenticator' | 'user_not_found';
export type StartRotationResult =
  | { ok: true; enrollment: TotpEnrollment }
  | { ok: false; reason: StartRotationFailure };

export async function startRotation(
  db: Db,
  userId: string,
  input: StartRotationInput,
  clock: Clock,
): Promise<StartRotationResult> {
  const counter = await verifyAuthenticatorForUser(db, userId, input.authenticatorCode, clock);
  if (counter == null) return { ok: false, reason: 'invalid_authenticator' };

  const user = await users.findUsernameById(db, userId);
  if (!user) return { ok: false, reason: 'user_not_found' };

  const expiresAt = new Date(clock.now() + env.PENDING_TOTP_TTL_MS);
  const enrollment = totp.enroll(user.username, expiresAt);

  await users.updateTotpCounter(db, userId, counter);
  await enrollments.deleteByUser(db, userId);
  const enrollmentId = await enrollments.createPending(db, {
    userId,
    encryptedSecret: enrollment.encryptedSecret,
    expiresAt,
  });

  return {
    ok: true,
    enrollment: {
      enrollmentId,
      setupKey: enrollment.plaintextSecret,
      otpauthUri: enrollment.qrUri,
      expiresAt: enrollment.expiresAt,
    },
  };
}

export type CompleteRotationInput = {
  enrollmentId: string;
  authenticatorCode: string;
};

export type CompleteRotationFailure = 'user_not_found' | 'invalid_enrollment';
export type CompleteRotationResult = { ok: true } | { ok: false; reason: CompleteRotationFailure };

export async function completeRotation(
  db: Db,
  userId: string,
  input: CompleteRotationInput,
  clock: Clock,
): Promise<CompleteRotationResult> {
  const user = await users.findCounterById(db, userId);
  if (!user) return { ok: false, reason: 'user_not_found' };

  const enrollment = await enrollments.findPending(db, input.enrollmentId, userId);
  if (!enrollment) return { ok: false, reason: 'invalid_enrollment' };

  const counter = totp.verify(
    enrollment.encryptedSecret,
    input.authenticatorCode,
    user.totpLastUsedCounter,
    clock.now(),
  );
  if (counter == null) return { ok: false, reason: 'invalid_enrollment' };

  await totpSecrets.replaceForUser(db, userId, enrollment.encryptedSecret);
  await enrollments.deleteByUser(db, userId);
  await sessions.deleteAllForUser(db, userId);
  await users.updateTotpCounter(db, userId, counter);

  return { ok: true };
}
