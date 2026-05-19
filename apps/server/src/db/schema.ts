import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  customType,
  index,
  integer,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { uuidv7 } from 'uuidv7';

const bytea = customType<{ data: Buffer }>({
  dataType() {
    return 'bytea';
  },
});

const now = sql`now()`;

export const users = pgTable(
  'users',
  {
    id: uuid('id')
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    username: varchar('username', { length: 32 }).notNull(),
    verified: boolean('verified').notNull().default(false),
    kekSalt: bytea('kek_salt'),
    encryptedMasterKeyCiphertext: bytea('encrypted_master_key_ciphertext'),
    encryptedMasterKeyNonce: bytea('encrypted_master_key_nonce'),
    encryptedMasterKeyForRecoveryCiphertext: bytea('encrypted_master_key_for_recovery_ciphertext'),
    encryptedMasterKeyForRecoveryNonce: bytea('encrypted_master_key_for_recovery_nonce'),
    encryptedPrivateKeyCiphertext: bytea('encrypted_private_key_ciphertext'),
    encryptedPrivateKeyNonce: bytea('encrypted_private_key_nonce'),
    encryptedRecoveryKeyCiphertext: bytea('encrypted_recovery_key_ciphertext'),
    encryptedRecoveryKeyNonce: bytea('encrypted_recovery_key_nonce'),
    publicKey: bytea('public_key'),
    recoveryVerifierHash: varchar('recovery_verifier_hash', { length: 255 }),
    recoveryVerifierSalt: bytea('recovery_verifier_salt'),
    totpLastUsedCounter: bigint('totp_last_used_counter', { mode: 'number' }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    ownerQuotaOverride: integer('owner_quota_override'),
    vaultItemQuotaOverride: integer('vault_item_quota_override'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(now),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().default(now),
  },
  (table) => [uniqueIndex('users_username_unique').on(table.username)],
);

export const projectSettings = pgTable('project_settings', {
  id: integer('id').primaryKey().default(1),
  adminUserId: uuid('admin_user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'restrict' }),
  registrationsEnabled: boolean('registrations_enabled').notNull().default(true),
  defaultOwnerQuota: integer('default_owner_quota').notNull().default(10),
  defaultVaultItemQuota: integer('default_vault_item_quota').notNull().default(1000),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(now),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().default(now),
});

export const userTotpSecrets = pgTable(
  'user_totp_secrets',
  {
    id: uuid('id')
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    encryptedSecret: bytea('encrypted_secret').notNull(),
    enabledAt: timestamp('enabled_at', { withTimezone: true }).notNull().default(now),
    lastRotatedAt: timestamp('last_rotated_at', { withTimezone: true }).notNull().default(now),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(now),
  },
  (table) => [uniqueIndex('user_totp_secrets_user_id_unique').on(table.userId)],
);

export const pendingTotpEnrollments = pgTable(
  'pending_totp_enrollments',
  {
    id: uuid('id')
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    encryptedSecret: bytea('encrypted_secret').notNull(),
    attempts: integer('attempts').notNull().default(0),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(now),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().default(now),
  },
  (table) => [
    index('pending_totp_enrollments_user_id_expires_at_idx').on(table.userId, table.expiresAt),
  ],
);

export const recoveryTokens = pgTable(
  'recovery_tokens',
  {
    id: uuid('id')
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: varchar('token_hash', { length: 64 }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(now),
  },
  (table) => [index('recovery_tokens_user_id_expires_at_idx').on(table.userId, table.expiresAt)],
);

export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id')
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: varchar('token_hash', { length: 64 }).notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }).notNull().default(now),
    userAgent: varchar('user_agent', { length: 512 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(now),
  },
  (table) => [
    index('sessions_user_id_idx').on(table.userId),
    index('sessions_expires_at_idx').on(table.expiresAt),
  ],
);

export const vaults = pgTable(
  'vaults',
  {
    id: uuid('id')
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    encryptedVaultKeyCiphertext: bytea('encrypted_vault_key_ciphertext').notNull(),
    encryptedVaultKeyNonce: bytea('encrypted_vault_key_nonce').notNull(),
    encryptedVaultDataCiphertext: bytea('encrypted_vault_data_ciphertext').notNull(),
    encryptedVaultDataNonce: bytea('encrypted_vault_data_nonce').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(now),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().default(now),
  },
  (table) => [index('vaults_user_id_idx').on(table.userId)],
);

export const vaultFolders = pgTable(
  'vault_folders',
  {
    id: uuid('id')
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    vaultId: uuid('vault_id')
      .notNull()
      .references(() => vaults.id, { onDelete: 'cascade' }),
    encryptedNameCiphertext: bytea('encrypted_name_ciphertext').notNull(),
    encryptedNameNonce: bytea('encrypted_name_nonce').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(now),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().default(now),
  },
  (table) => [index('vault_folders_vault_id_idx').on(table.vaultId)],
);

export const vaultItems = pgTable(
  'vault_items',
  {
    id: uuid('id')
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    vaultId: uuid('vault_id')
      .notNull()
      .references(() => vaults.id, { onDelete: 'cascade' }),
    folderId: uuid('folder_id').references(() => vaultFolders.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(now),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().default(now),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    index('vault_items_vault_id_deleted_at_id_idx').on(table.vaultId, table.deletedAt, table.id),
    index('vault_items_vault_id_updated_at_idx').on(table.vaultId, table.updatedAt),
    index('vault_items_folder_id_idx').on(table.folderId),
  ],
);

export const vaultItemVersions = pgTable(
  'vault_item_versions',
  {
    id: uuid('id')
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    itemId: uuid('item_id')
      .notNull()
      .references(() => vaultItems.id, { onDelete: 'cascade' }),
    versionNum: integer('version_num').notNull(),
    encryptedDataCiphertext: bytea('encrypted_data_ciphertext').notNull(),
    encryptedDataNonce: bytea('encrypted_data_nonce').notNull(),
    encryptedItemKeyCiphertext: bytea('encrypted_item_key_ciphertext').notNull(),
    encryptedItemKeyNonce: bytea('encrypted_item_key_nonce').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(now),
  },
  (table) => [
    uniqueIndex('vault_item_versions_item_version_unique').on(table.itemId, table.versionNum),
    index('vault_item_versions_item_id_idx').on(table.itemId),
  ],
);

export const biometricCredentials = pgTable(
  'biometric_credentials',
  {
    id: uuid('id')
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    credentialId: bytea('credential_id').notNull(),
    label: varchar('label', { length: 255 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(now),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().default(now),
  },
  (table) => [
    index('biometric_credentials_user_id_idx').on(table.userId),
    uniqueIndex('biometric_credentials_user_credential_unique').on(
      table.userId,
      table.credentialId,
    ),
  ],
);

export const vaultShares = pgTable(
  'vault_shares',
  {
    id: uuid('id')
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    vaultId: uuid('vault_id')
      .notNull()
      .references(() => vaults.id, { onDelete: 'cascade' }),
    ownerUserId: uuid('owner_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    receiverUserId: uuid('receiver_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    sealedVaultKey: bytea('sealed_vault_key').notNull(),
    role: varchar('role', { length: 20 }).notNull().default('viewer'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(now),
  },
  (table) => [
    uniqueIndex('vault_shares_vault_receiver_unique').on(table.vaultId, table.receiverUserId),
    index('vault_shares_vault_id_idx').on(table.vaultId),
    index('vault_shares_receiver_user_id_idx').on(table.receiverUserId),
  ],
);
