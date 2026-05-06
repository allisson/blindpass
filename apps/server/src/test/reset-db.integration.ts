import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env['DATABASE_URL'] });

export async function resetDatabase(): Promise<void> {
  await pool.query(`
    TRUNCATE TABLE vault_item_versions, vault_items, vault_folders,
    vault_shares, vaults, recovery_tokens, pending_totp_enrollments,
    user_totp_secrets, sessions, project_settings, users
    RESTART IDENTITY CASCADE;
  `);
}

export async function closeResetPool(): Promise<void> {
  await pool.end();
}
