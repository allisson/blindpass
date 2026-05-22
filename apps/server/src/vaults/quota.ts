import { count, eq, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type * as schema from '../db/schema.js';
import { projectSettings, users, vaultItems, vaults } from '../db/schema.js';
import type { TxDb } from '../db/tx.js';

// Reads accept either handle. Asserts require a real transaction — the
// `pg_advisory_xact_lock` held by `acquireLock` is released when its statement
// commits, so calling these on `app.db` (auto-commit per statement) silently
// disables the quota's concurrency invariant. The brand makes that misuse a
// type error.
type Db = NodePgDatabase<typeof schema>;

// Branded opaque type minted by `reserveItemQuota` and consumed by item-
// inserting repo methods. The brand makes "you cannot insert items without
// having reserved quota" a compile-time obligation, mirroring `ProofOfSession`
// and `TxDb`. `vaultId` ties the slot to its scope so a future cross-vault
// write in one tx cannot accidentally reuse a slot from another vault.
declare const QuotaSlotTag: unique symbol;
export type QuotaSlot = {
  readonly vaultId: string;
  readonly [QuotaSlotTag]: true;
};

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

async function acquireLock(tx: TxDb, key: string): Promise<void> {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${key})::bigint)`);
}

export async function assertVaultQuota(tx: TxDb, userId: string, limit: number): Promise<void> {
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

export async function reserveItemQuota(tx: TxDb, vaultId: string, adding = 1): Promise<QuotaSlot> {
  const limit = await getEffectiveVaultItemQuota(tx, vaultId);
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
  return { vaultId } as QuotaSlot;
}
