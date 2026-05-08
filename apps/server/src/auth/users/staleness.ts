import { eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../db/schema.js';
import { projectSettings } from '../../db/schema.js';
import { env } from '../../env.js';
import * as users from './repository.js';

type Db = NodePgDatabase<typeof schema>;

export function isUserStaleUnverified(user: { verified: boolean; createdAt: Date }): boolean {
  return !user.verified && Date.now() - user.createdAt.getTime() >= env.UNVERIFIED_ACCOUNT_TTL_MS;
}

export async function gcStaleUnverified(db: Db, userId: string): Promise<void> {
  const [settings] = await db.select().from(projectSettings).where(eq(projectSettings.id, 1));
  if (settings?.adminUserId === userId) {
    await db.delete(projectSettings).where(eq(projectSettings.id, 1));
  }
  await users.deleteById(db, userId);
}
