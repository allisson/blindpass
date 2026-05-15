import { randomBytes } from 'node:crypto';
import type { TotpEnrollment } from '@blindpass/api-schema';
import type { TxDb } from '../../db/tx.js';
import type { Clock } from '../../plugins/clock.js';
import { env } from '../../env.js';
import { hashToken } from '../../utils/otp.js';
import * as totp from '../totp/index.js';
import * as session from '../session/index.js';
import { fromUserRow } from '../bundle/from-user-row.js';
import * as users from '../users/repository.js';
import * as enrollments from '../enrollments/repository.js';
import * as totpSecrets from '../totp-secrets/repository.js';
import * as recoveryTokens from '../recovery-tokens/repository.js';
import * as sessionsRepo from '../sessions/repository.js';
import * as verifier from './verifier.js';

type Db = TxDb;

export type VerifyRecoveryInput = {
  username: string;
  recoveryVerifier: string;
};

export type VerifyRecoveryResult =
  | {
      ok: true;
      recoveryToken: string;
      enrollment: TotpEnrollment;
      bundle: ReturnType<typeof fromUserRow>;
    }
  | { ok: false; reason: 'invalid_credentials' };

export async function verifyRecovery(
  db: Db,
  input: VerifyRecoveryInput,
  clock: Clock,
): Promise<VerifyRecoveryResult> {
  const user = await users.findFullByUsername(db, input.username);
  if (
    !user ||
    !user.verified ||
    user.revokedAt ||
    !verifier.verify(
      input.recoveryVerifier,
      user.recoveryVerifierHash,
      user.recoveryVerifierSalt,
    ) ||
    !user.publicKey ||
    !user.kekSalt
  ) {
    return { ok: false, reason: 'invalid_credentials' };
  }

  const recoveryToken = randomBytes(32).toString('hex');
  const recoveryExpiry = new Date(clock.now() + env.RECOVERY_TOKEN_TTL_MS);
  const enrollmentExpiry = new Date(clock.now() + env.PENDING_TOTP_TTL_MS);
  const enrollment = totp.enroll(user.username, enrollmentExpiry);

  await recoveryTokens.deleteAllForUser(db, user.id);
  await enrollments.deleteByUser(db, user.id);
  const enrollmentId = await enrollments.createPending(db, {
    userId: user.id,
    encryptedSecret: enrollment.encryptedSecret,
    expiresAt: enrollmentExpiry,
  });
  await recoveryTokens.create(db, {
    userId: user.id,
    tokenHash: hashToken(recoveryToken),
    expiresAt: recoveryExpiry,
  });

  return {
    ok: true,
    recoveryToken,
    enrollment: {
      enrollmentId,
      setupKey: enrollment.plaintextSecret,
      otpauthUri: enrollment.qrUri,
      expiresAt: enrollment.expiresAt,
    },
    bundle: fromUserRow(user),
  };
}

export type CompleteRecoveryInput = {
  username: string;
  recoveryToken: string;
  enrollmentId: string;
  authenticatorCode: string;
  recoveryVerifier: string;
  userAgent: string | undefined;
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
};

export type CompleteRecoveryResult =
  | { ok: true; proof: session.ProofOfSession; bundle: ReturnType<typeof fromUserRow> }
  | { ok: false; reason: 'invalid' | 'not_provisioned' };

export async function completeRecovery(
  db: Db,
  input: CompleteRecoveryInput,
  clock: Clock,
): Promise<CompleteRecoveryResult> {
  const user = await users.findFullByUsername(db, input.username);
  if (!user || user.revokedAt) {
    return { ok: false, reason: 'invalid' };
  }

  const token = await recoveryTokens.findActiveByUserAndHash(
    db,
    user.id,
    hashToken(input.recoveryToken),
  );
  if (!token) {
    return { ok: false, reason: 'invalid' };
  }

  const enrollment = await enrollments.findPending(db, input.enrollmentId, user.id);
  if (!enrollment) {
    return { ok: false, reason: 'invalid' };
  }

  const counter = totp.verify(
    enrollment.encryptedSecret,
    input.authenticatorCode,
    null,
    clock.now(),
  );
  if (counter == null) {
    return { ok: false, reason: 'invalid' };
  }

  const nextRecovery = verifier.hash(input.recoveryVerifier);

  await sessionsRepo.deleteAllForUser(db, user.id);
  await recoveryTokens.deleteAllForUser(db, user.id);
  await enrollments.deleteByUser(db, user.id);
  await totpSecrets.replaceForUser(db, user.id, enrollment.encryptedSecret);
  await users.applyRecoveryRekey(db, user.id, {
    counter,
    recoveryVerifierHash: nextRecovery.hash,
    recoveryVerifierSalt: nextRecovery.salt,
    ...input.newKeys,
  });
  const fullUser = await users.findFullById(db, user.id);

  if (!fullUser?.publicKey || !fullUser.kekSalt) {
    return { ok: false, reason: 'not_provisioned' };
  }

  const proof = await session.issue(db, user.id, input.userAgent, clock);
  return { ok: true, proof, bundle: fromUserRow(fullUser) };
}
