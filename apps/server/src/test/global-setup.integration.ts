import { resolve } from 'node:path';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';

const DEFAULT_DB_URL = 'postgres://postgres:blindpass@localhost:5432/blindpass';

export async function setup() {
  const pool = new Pool({ connectionString: process.env['DATABASE_URL'] ?? DEFAULT_DB_URL });
  await pool.query(`
    DROP TABLE IF EXISTS vault_item_versions CASCADE;
    DROP TABLE IF EXISTS vault_items CASCADE;
    DROP TABLE IF EXISTS vault_folders CASCADE;
    DROP TABLE IF EXISTS vault_shares CASCADE;
    DROP TABLE IF EXISTS vaults CASCADE;
    DROP TABLE IF EXISTS recovery_tokens CASCADE;
    DROP TABLE IF EXISTS pending_totp_enrollments CASCADE;
    DROP TABLE IF EXISTS user_totp_secrets CASCADE;
    DROP TABLE IF EXISTS sessions CASCADE;
    DROP TABLE IF EXISTS project_settings CASCADE;
    DROP TABLE IF EXISTS biometric_credentials CASCADE;
    DROP TABLE IF EXISTS users CASCADE;
    DROP SCHEMA IF EXISTS drizzle CASCADE;
  `);
  const db = drizzle(pool);
  await migrate(db, { migrationsFolder: resolve(process.cwd(), 'src/db/migrations') });
  await pool.end();
}

export async function teardown() {
  const pool = new Pool({ connectionString: process.env['DATABASE_URL'] ?? DEFAULT_DB_URL });
  await pool.query(`
    TRUNCATE TABLE vault_item_versions, vault_items, vault_folders,
    vault_shares, vaults, recovery_tokens, pending_totp_enrollments,
    user_totp_secrets, sessions, project_settings, biometric_credentials, users
    RESTART IDENTITY CASCADE;
  `);
  await pool.end();
}
