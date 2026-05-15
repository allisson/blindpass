import { sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { TotpEnrollment } from '@blindpass/api-schema';
import * as schema from '../../db/schema.js';
import { env } from '../../env.js';
import * as totp from '../totp/index.js';
import * as session from '../session/index.js';
import { fromUserRow } from '../bundle/from-user-row.js';
import { hash as hashRecoveryVerifier } from '../recovery/verifier.js';
import { isUserStaleUnverified } from '../users/staleness.js';
import * as users from '../users/repository.js';
import * as enrollments from '../enrollments/repository.js';
import * as totpSecrets from '../totp-secrets/repository.js';
import * as projectSettingsRepo from '../project-settings/repository.js';
import * as vaultsRepo from '../../vaults/repository.js';

type Db = NodePgDatabase<typeof schema>;

const MAX_ATTEMPTS = 3;

export type CompleteRegistrationInput = {
  username: string;
  enrollmentId: string;
  authenticatorCode: string;
  userAgent: string | undefined;
};

export type CompleteRegistrationResult =
  | { ok: true; proof: session.ProofOfSession; bundle: ReturnType<typeof fromUserRow> }
  | { ok: false; reason: 'invalid_enrollment' | 'not_provisioned' };

export async function completeRegistration(
  db: Db,
  input: CompleteRegistrationInput,
): Promise<CompleteRegistrationResult> {
  const user = await users.findFullByUsername(db, input.username);
  if (!user || user.revokedAt || user.verified) {
    return { ok: false, reason: 'invalid_enrollment' };
  }

  const enrollment = await enrollments.findPending(db, input.enrollmentId, user.id);
  if (!enrollment) {
    return { ok: false, reason: 'invalid_enrollment' };
  }

  const counter = totp.verify(
    enrollment.encryptedSecret,
    input.authenticatorCode,
    user.totpLastUsedCounter,
  );
  if (counter == null) {
    const attempts = enrollment.attempts + 1;
    await enrollments.bumpAttempts(db, enrollment.id, attempts);
    if (attempts >= MAX_ATTEMPTS) {
      await enrollments.deleteById(db, enrollment.id);
    }
    return { ok: false, reason: 'invalid_enrollment' };
  }

  await totpSecrets.replaceForUser(db, user.id, enrollment.encryptedSecret);
  await enrollments.deleteByUser(db, user.id);
  await users.markVerifiedAndCounter(db, user.id, counter);
  const fullUser = await users.findFullById(db, user.id);

  if (!fullUser?.publicKey || !fullUser.kekSalt) {
    return { ok: false, reason: 'not_provisioned' };
  }

  const proof = await session.issue(db, user.id, input.userAgent);
  return { ok: true, proof, bundle: fromUserRow(fullUser) };
}

export type RegisterUserInput = {
  username: string;
  recoveryVerifier: string;
  newKeys: {
    kekSalt: Buffer;
    publicKey: Buffer;
    encryptedMasterKeyCiphertext: Buffer;
    encryptedMasterKeyNonce: Buffer;
    encryptedMasterKeyForRecoveryCiphertext: Buffer;
    encryptedMasterKeyForRecoveryNonce: Buffer;
    encryptedPrivateKeyCiphertext: Buffer;
    encryptedPrivateKeyNonce: Buffer;
    encryptedRecoveryKeyCiphertext: Buffer;
    encryptedRecoveryKeyNonce: Buffer;
  };
  vault: {
    encryptedVaultKeyCiphertext: Buffer;
    encryptedVaultKeyNonce: Buffer;
    encryptedVaultDataCiphertext: Buffer;
    encryptedVaultDataNonce: Buffer;
  };
};

export type RegisterUserResult =
  | { ok: true; enrollment: TotpEnrollment }
  | { ok: false; reason: 'registrations_disabled' | 'username_taken' };

export async function registerUser(db: Db, input: RegisterUserInput): Promise<RegisterUserResult> {
  await db.execute(sql`select pg_advisory_xact_lock(hashtext('admin_bootstrap')::bigint)`);

  const settings = await projectSettingsRepo.findOne(db);
  let bootstrapAdminUser = !settings;
  if (settings && !settings.registrationsEnabled) {
    return { ok: false, reason: 'registrations_disabled' };
  }

  const existing = await users.findStalenessProbeByUsername(db, input.username);
  if (existing) {
    if (!isUserStaleUnverified(existing)) {
      return { ok: false, reason: 'username_taken' };
    }
    if (settings?.adminUserId === existing.id) {
      await projectSettingsRepo.deleteOne(db);
      bootstrapAdminUser = true;
    }
    await users.deleteById(db, existing.id);
  }

  const recoveryVerifier = hashRecoveryVerifier(input.recoveryVerifier);
  const userId = await users.create(db, {
    username: input.username,
    ...input.newKeys,
    recoveryVerifierHash: recoveryVerifier.hash,
    recoveryVerifierSalt: recoveryVerifier.salt,
  });

  if (bootstrapAdminUser) {
    await projectSettingsRepo.createBootstrap(db, userId);
  }

  await vaultsRepo.createInitial(db, { userId, ...input.vault });

  const enrollmentExpiry = new Date(Date.now() + env.PENDING_TOTP_TTL_MS);
  const enrollment = totp.enroll(input.username, enrollmentExpiry);
  const enrollmentId = await enrollments.createPending(db, {
    userId,
    encryptedSecret: enrollment.encryptedSecret,
    expiresAt: enrollmentExpiry,
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
