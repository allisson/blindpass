import { and, desc, eq, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../db/schema.js';
import { biometricCredentials } from '../../db/schema.js';

type Db = NodePgDatabase<typeof schema>;

export type BiometricCredentialRow = {
  id: string;
  label: string | null;
  createdAt: Date;
  lastSeenAt: Date;
};

export async function register(
  db: Db,
  userId: string,
  credentialIdBuf: Buffer,
  label?: string,
): Promise<{ id: string; createdAt: Date }> {
  const [row] = await db
    .insert(biometricCredentials)
    .values({ userId, credentialId: credentialIdBuf, label })
    .returning({ id: biometricCredentials.id, createdAt: biometricCredentials.createdAt });
  return row;
}

export async function listForUser(db: Db, userId: string): Promise<BiometricCredentialRow[]> {
  return db
    .select({
      id: biometricCredentials.id,
      label: biometricCredentials.label,
      createdAt: biometricCredentials.createdAt,
      lastSeenAt: biometricCredentials.lastSeenAt,
    })
    .from(biometricCredentials)
    .where(eq(biometricCredentials.userId, userId))
    .orderBy(desc(biometricCredentials.createdAt));
}

export async function findByIdForUser(
  db: Db,
  id: string,
  userId: string,
): Promise<BiometricCredentialRow | null> {
  const [row] = await db
    .select({
      id: biometricCredentials.id,
      label: biometricCredentials.label,
      createdAt: biometricCredentials.createdAt,
      lastSeenAt: biometricCredentials.lastSeenAt,
    })
    .from(biometricCredentials)
    .where(and(eq(biometricCredentials.id, id), eq(biometricCredentials.userId, userId)));
  return row ?? null;
}

export async function deleteByIdForUser(db: Db, id: string, userId: string): Promise<boolean> {
  const result = await db
    .delete(biometricCredentials)
    .where(and(eq(biometricCredentials.id, id), eq(biometricCredentials.userId, userId)))
    .returning({ id: biometricCredentials.id });
  return result.length > 0;
}

export async function touchLastSeen(db: Db, id: string): Promise<void> {
  await db
    .update(biometricCredentials)
    .set({ lastSeenAt: sql`now()` })
    .where(eq(biometricCredentials.id, id));
}
