import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../db/schema.js';
import { verifyAuthenticatorForUser } from '../totp/verify-for-user.js';
import { hash as hashRecoveryVerifier } from '../recovery/verifier.js';
import * as users from '../users/repository.js';
import * as sessions from '../sessions/repository.js';
import * as projectSettings from '../project-settings/repository.js';

type Db = NodePgDatabase<typeof schema>;

export type ChangePasswordInput = {
  authenticatorCode: string;
  kekSalt: Buffer;
  encryptedMasterKeyCiphertext: Buffer;
  encryptedMasterKeyNonce: Buffer;
};

export type ChangePasswordResult = { ok: true } | { ok: false; reason: 'invalid_authenticator' };

export async function changePassword(
  db: Db,
  userId: string,
  input: ChangePasswordInput,
): Promise<ChangePasswordResult> {
  const counter = await verifyAuthenticatorForUser(db, userId, input.authenticatorCode);
  if (counter == null) return { ok: false, reason: 'invalid_authenticator' };

  await users.applyPasswordChange(db, userId, {
    kekSalt: input.kekSalt,
    encryptedMasterKeyCiphertext: input.encryptedMasterKeyCiphertext,
    encryptedMasterKeyNonce: input.encryptedMasterKeyNonce,
    counter,
  });
  await sessions.deleteAllForUser(db, userId);
  return { ok: true };
}

export type RotateRecoveryPhraseInput = {
  authenticatorCode: string;
  recoveryVerifier: string;
  publicKey: Buffer;
  encryptedMasterKeyForRecoveryCiphertext: Buffer;
  encryptedMasterKeyForRecoveryNonce: Buffer;
  encryptedPrivateKeyCiphertext: Buffer;
  encryptedPrivateKeyNonce: Buffer;
  encryptedRecoveryKeyCiphertext: Buffer;
  encryptedRecoveryKeyNonce: Buffer;
};

export type RotateRecoveryPhraseResult =
  | { ok: true }
  | { ok: false; reason: 'invalid_authenticator' };

export async function rotateRecoveryPhrase(
  db: Db,
  userId: string,
  input: RotateRecoveryPhraseInput,
): Promise<RotateRecoveryPhraseResult> {
  const counter = await verifyAuthenticatorForUser(db, userId, input.authenticatorCode);
  if (counter == null) return { ok: false, reason: 'invalid_authenticator' };

  const verifier = hashRecoveryVerifier(input.recoveryVerifier);
  await users.applyRecoveryPhraseRotation(db, userId, {
    publicKey: input.publicKey,
    encryptedMasterKeyForRecoveryCiphertext: input.encryptedMasterKeyForRecoveryCiphertext,
    encryptedMasterKeyForRecoveryNonce: input.encryptedMasterKeyForRecoveryNonce,
    encryptedPrivateKeyCiphertext: input.encryptedPrivateKeyCiphertext,
    encryptedPrivateKeyNonce: input.encryptedPrivateKeyNonce,
    encryptedRecoveryKeyCiphertext: input.encryptedRecoveryKeyCiphertext,
    encryptedRecoveryKeyNonce: input.encryptedRecoveryKeyNonce,
    recoveryVerifierHash: verifier.hash,
    recoveryVerifierSalt: verifier.salt,
    counter,
  });
  return { ok: true };
}

export type DeleteAccountInput = {
  authenticatorCode: string;
};

export type DeleteAccountResult =
  | { ok: true }
  | { ok: false; reason: 'invalid_authenticator' | 'admin_user_protected' };

export async function deleteAccount(
  db: Db,
  userId: string,
  input: DeleteAccountInput,
): Promise<DeleteAccountResult> {
  const counter = await verifyAuthenticatorForUser(db, userId, input.authenticatorCode);
  if (counter == null) return { ok: false, reason: 'invalid_authenticator' };

  const settings = await projectSettings.findOne(db);
  if (settings?.adminUserId === userId) {
    return { ok: false, reason: 'admin_user_protected' };
  }

  await users.updateTotpCounter(db, userId, counter);
  await users.deleteById(db, userId);
  return { ok: true };
}
