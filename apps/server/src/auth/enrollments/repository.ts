import { and, eq, gt, lt } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../db/schema.js';
import { pendingTotpEnrollments } from '../../db/schema.js';

type Db = NodePgDatabase<typeof schema>;

export type PendingEnrollmentRow = typeof pendingTotpEnrollments.$inferSelect;

export async function purgeExpired(db: Db, before: Date): Promise<void> {
  await db.delete(pendingTotpEnrollments).where(lt(pendingTotpEnrollments.expiresAt, before));
}

export async function findPending(
  db: Db,
  enrollmentId: string,
  userId: string,
): Promise<PendingEnrollmentRow | undefined> {
  const [row] = await db
    .select()
    .from(pendingTotpEnrollments)
    .where(
      and(
        eq(pendingTotpEnrollments.id, enrollmentId),
        eq(pendingTotpEnrollments.userId, userId),
        gt(pendingTotpEnrollments.expiresAt, new Date()),
      ),
    )
    .limit(1);
  return row;
}

export async function bumpAttempts(db: Db, enrollmentId: string, attempts: number): Promise<void> {
  await db
    .update(pendingTotpEnrollments)
    .set({ attempts, updatedAt: new Date() })
    .where(eq(pendingTotpEnrollments.id, enrollmentId));
}

export async function deleteById(db: Db, enrollmentId: string): Promise<void> {
  await db.delete(pendingTotpEnrollments).where(eq(pendingTotpEnrollments.id, enrollmentId));
}

export async function deleteByUser(db: Db, userId: string): Promise<void> {
  await db.delete(pendingTotpEnrollments).where(eq(pendingTotpEnrollments.userId, userId));
}

export async function createPending(
  db: Db,
  values: { userId: string; encryptedSecret: Buffer; expiresAt: Date },
): Promise<string> {
  const [row] = await db
    .insert(pendingTotpEnrollments)
    .values(values)
    .returning({ id: pendingTotpEnrollments.id });
  return row.id;
}
