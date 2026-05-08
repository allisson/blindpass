import { and, desc, eq, ne } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../db/schema.js';
import { sessions } from '../../db/schema.js';

type Db = NodePgDatabase<typeof schema>;

export type SessionListRow = {
  id: string;
  createdAt: Date;
  lastUsedAt: Date;
  userAgent: string | null;
};

export async function deleteById(db: Db, sessionId: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.id, sessionId));
}

export async function deleteAllForUser(db: Db, userId: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.userId, userId));
}

export async function listForUser(db: Db, userId: string): Promise<SessionListRow[]> {
  return db
    .select({
      id: sessions.id,
      createdAt: sessions.createdAt,
      lastUsedAt: sessions.lastUsedAt,
      userAgent: sessions.userAgent,
    })
    .from(sessions)
    .where(eq(sessions.userId, userId))
    .orderBy(desc(sessions.lastUsedAt));
}

export async function deleteByIdForUser(
  db: Db,
  sessionId: string,
  userId: string,
): Promise<boolean> {
  const result = await db
    .delete(sessions)
    .where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId)))
    .returning({ id: sessions.id });
  return result.length > 0;
}

export async function deleteAllForUserExcept(
  db: Db,
  userId: string,
  exceptSessionId: string,
): Promise<void> {
  await db
    .delete(sessions)
    .where(and(eq(sessions.userId, userId), ne(sessions.id, exceptSessionId)));
}
