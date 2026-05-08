import { and, eq, gt } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../db/schema.js';
import { recoveryTokens } from '../../db/schema.js';

type Db = NodePgDatabase<typeof schema>;

export type RecoveryTokenRow = typeof recoveryTokens.$inferSelect;

export async function deleteAllForUser(db: Db, userId: string): Promise<void> {
  await db.delete(recoveryTokens).where(eq(recoveryTokens.userId, userId));
}

export async function create(
  db: Db,
  values: { userId: string; tokenHash: string; expiresAt: Date },
): Promise<void> {
  await db.insert(recoveryTokens).values(values);
}

export async function findActiveByUserAndHash(
  db: Db,
  userId: string,
  tokenHash: string,
): Promise<RecoveryTokenRow | undefined> {
  const [row] = await db
    .select()
    .from(recoveryTokens)
    .where(
      and(
        eq(recoveryTokens.userId, userId),
        eq(recoveryTokens.tokenHash, tokenHash),
        gt(recoveryTokens.expiresAt, new Date()),
      ),
    )
    .limit(1);
  return row;
}
