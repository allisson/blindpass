import { count, eq, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type * as schema from '../db/schema.js';
import { projectSettings, users, vaultItems, vaults } from '../db/schema.js';

type Db = NodePgDatabase<typeof schema>;

export type QuotaErrorCode = 'vault_limit_reached' | 'item_limit_reached';

export class QuotaExceededError extends Error {
  readonly code: QuotaErrorCode;
  readonly limit: number;
  readonly current: number;
  readonly requested?: number;

  constructor(args: { code: QuotaErrorCode; limit: number; current: number; requested?: number }) {
    super(args.code);
    this.name = 'QuotaExceededError';
    this.code = args.code;
    this.limit = args.limit;
    this.current = args.current;
    this.requested = args.requested;
  }
}

async function acquireLock(tx: Db, key: string): Promise<void> {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${key})::bigint)`);
}

export async function assertVaultQuota(tx: Db, userId: string, limit: number): Promise<void> {
  await acquireLock(tx, `vault_quota:${userId}`);
  const [row] = await tx.select({ value: count() }).from(vaults).where(eq(vaults.userId, userId));
  const current = Number(row?.value ?? 0);
  if (current >= limit) {
    throw new QuotaExceededError({ code: 'vault_limit_reached', limit, current });
  }
}

export async function getEffectiveOwnerQuota(tx: Db, userId: string): Promise<number> {
  const [row] = await tx
    .select({
      override: users.ownerQuotaOverride,
      defaultQuota: projectSettings.defaultOwnerQuota,
    })
    .from(users)
    .innerJoin(projectSettings, eq(projectSettings.id, 1))
    .where(eq(users.id, userId))
    .limit(1);
  return row?.override ?? row?.defaultQuota ?? 10;
}

export async function getEffectiveVaultItemQuota(tx: Db, vaultId: string): Promise<number> {
  const [row] = await tx
    .select({
      override: users.vaultItemQuotaOverride,
      defaultQuota: projectSettings.defaultVaultItemQuota,
    })
    .from(vaults)
    .innerJoin(users, eq(users.id, vaults.userId))
    .innerJoin(projectSettings, eq(projectSettings.id, 1))
    .where(eq(vaults.id, vaultId))
    .limit(1);
  return row?.override ?? row?.defaultQuota ?? 1000;
}

export async function assertItemQuota(
  tx: Db,
  vaultId: string,
  limit: number,
  adding = 1,
): Promise<void> {
  await acquireLock(tx, `item_quota:${vaultId}`);
  const [row] = await tx
    .select({ value: count() })
    .from(vaultItems)
    .where(eq(vaultItems.vaultId, vaultId));
  const current = Number(row?.value ?? 0);
  if (current + adding > limit) {
    throw new QuotaExceededError({
      code: 'item_limit_reached',
      limit,
      current,
      requested: adding,
    });
  }
}
