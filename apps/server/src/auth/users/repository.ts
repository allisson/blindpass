import { and, eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../db/schema.js';
import { users } from '../../db/schema.js';

type Db = NodePgDatabase<typeof schema>;

export type UserCredentialsRow = {
  id: string;
  verified: boolean;
  revokedAt: Date | null;
};

export type StalenessProbeRow = {
  id: string;
  verified: boolean;
  createdAt: Date;
};

export async function findStalenessProbeByUsername(
  db: Db,
  username: string,
): Promise<StalenessProbeRow | undefined> {
  const [row] = await db
    .select({ id: users.id, verified: users.verified, createdAt: users.createdAt })
    .from(users)
    .where(eq(users.username, username))
    .limit(1);
  return row;
}

export async function deleteById(db: Db, userId: string): Promise<void> {
  await db.delete(users).where(eq(users.id, userId));
}

export type CreateUserValues = {
  username: string;
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
  recoveryVerifierHash: string;
  recoveryVerifierSalt: Buffer;
};

export async function create(db: Db, values: CreateUserValues): Promise<string> {
  const [row] = await db.insert(users).values(values).returning({ id: users.id });
  return row.id;
}

export async function findCredentialsByUsername(
  db: Db,
  username: string,
): Promise<UserCredentialsRow | undefined> {
  const [row] = await db
    .select({ id: users.id, verified: users.verified, revokedAt: users.revokedAt })
    .from(users)
    .where(eq(users.username, username))
    .limit(1);
  return row;
}

export async function updateTotpCounter(db: Db, userId: string, counter: number): Promise<void> {
  await db
    .update(users)
    .set({ totpLastUsedCounter: counter, updatedAt: new Date() })
    .where(eq(users.id, userId));
}

export type FullUserRow = typeof users.$inferSelect;

export async function findFullByUsername(
  db: Db,
  username: string,
): Promise<FullUserRow | undefined> {
  const [row] = await db.select().from(users).where(eq(users.username, username)).limit(1);
  return row;
}

export async function findFullById(db: Db, userId: string): Promise<FullUserRow | undefined> {
  const [row] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return row;
}

export async function markVerifiedAndCounter(
  db: Db,
  userId: string,
  counter: number,
): Promise<void> {
  await db
    .update(users)
    .set({ verified: true, totpLastUsedCounter: counter, updatedAt: new Date() })
    .where(eq(users.id, userId));
}

export type RecoveryRekeyValues = {
  counter: number;
  recoveryVerifierHash: string;
  recoveryVerifierSalt: Buffer;
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

export type PublicKeyLookupRow = { id: string; publicKey: Buffer | null };

export async function findVerifiedById(
  db: Db,
  userId: string,
): Promise<{ id: string; username: string } | undefined> {
  const [row] = await db
    .select({ id: users.id, username: users.username })
    .from(users)
    .where(and(eq(users.id, userId), eq(users.verified, true)))
    .limit(1);
  return row;
}

export async function findVerifiedByUsername(
  db: Db,
  username: string,
): Promise<PublicKeyLookupRow | undefined> {
  const [row] = await db
    .select({ id: users.id, publicKey: users.publicKey })
    .from(users)
    .where(and(eq(users.username, username), eq(users.verified, true)))
    .limit(1);
  return row;
}

export async function findUsernameById(
  db: Db,
  userId: string,
): Promise<{ username: string } | undefined> {
  const [row] = await db
    .select({ username: users.username })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row;
}

export async function findCounterById(
  db: Db,
  userId: string,
): Promise<{ totpLastUsedCounter: number | null } | undefined> {
  const [row] = await db
    .select({ totpLastUsedCounter: users.totpLastUsedCounter })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row;
}

export type PasswordChangeValues = {
  kekSalt: Buffer;
  encryptedMasterKeyCiphertext: Buffer;
  encryptedMasterKeyNonce: Buffer;
  counter: number;
};

export async function applyPasswordChange(
  db: Db,
  userId: string,
  v: PasswordChangeValues,
): Promise<void> {
  await db
    .update(users)
    .set({
      kekSalt: v.kekSalt,
      encryptedMasterKeyCiphertext: v.encryptedMasterKeyCiphertext,
      encryptedMasterKeyNonce: v.encryptedMasterKeyNonce,
      totpLastUsedCounter: v.counter,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));
}

export type RecoveryPhraseRotationValues = {
  publicKey: Buffer;
  encryptedMasterKeyForRecoveryCiphertext: Buffer;
  encryptedMasterKeyForRecoveryNonce: Buffer;
  encryptedPrivateKeyCiphertext: Buffer;
  encryptedPrivateKeyNonce: Buffer;
  encryptedRecoveryKeyCiphertext: Buffer;
  encryptedRecoveryKeyNonce: Buffer;
  recoveryVerifierHash: string;
  recoveryVerifierSalt: Buffer;
  counter: number;
};

export async function applyRecoveryPhraseRotation(
  db: Db,
  userId: string,
  v: RecoveryPhraseRotationValues,
): Promise<void> {
  await db
    .update(users)
    .set({
      publicKey: v.publicKey,
      encryptedMasterKeyForRecoveryCiphertext: v.encryptedMasterKeyForRecoveryCiphertext,
      encryptedMasterKeyForRecoveryNonce: v.encryptedMasterKeyForRecoveryNonce,
      encryptedPrivateKeyCiphertext: v.encryptedPrivateKeyCiphertext,
      encryptedPrivateKeyNonce: v.encryptedPrivateKeyNonce,
      encryptedRecoveryKeyCiphertext: v.encryptedRecoveryKeyCiphertext,
      encryptedRecoveryKeyNonce: v.encryptedRecoveryKeyNonce,
      recoveryVerifierHash: v.recoveryVerifierHash,
      recoveryVerifierSalt: v.recoveryVerifierSalt,
      totpLastUsedCounter: v.counter,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));
}

export type KeyBundleUpdateValues = {
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

export async function updateKeyBundle(
  db: Db,
  userId: string,
  v: KeyBundleUpdateValues,
): Promise<void> {
  await db
    .update(users)
    .set({
      ...v,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));
}

export async function applyRecoveryRekey(
  db: Db,
  userId: string,
  v: RecoveryRekeyValues,
): Promise<void> {
  await db
    .update(users)
    .set({
      verified: true,
      kekSalt: v.kekSalt,
      publicKey: v.publicKey,
      encryptedMasterKeyCiphertext: v.encryptedMasterKeyCiphertext,
      encryptedMasterKeyNonce: v.encryptedMasterKeyNonce,
      encryptedMasterKeyForRecoveryCiphertext: v.encryptedMasterKeyForRecoveryCiphertext,
      encryptedMasterKeyForRecoveryNonce: v.encryptedMasterKeyForRecoveryNonce,
      encryptedPrivateKeyCiphertext: v.encryptedPrivateKeyCiphertext,
      encryptedPrivateKeyNonce: v.encryptedPrivateKeyNonce,
      encryptedRecoveryKeyCiphertext: v.encryptedRecoveryKeyCiphertext,
      encryptedRecoveryKeyNonce: v.encryptedRecoveryKeyNonce,
      recoveryVerifierHash: v.recoveryVerifierHash,
      recoveryVerifierSalt: v.recoveryVerifierSalt,
      totpLastUsedCounter: v.counter,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));
}
