import { eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../db/schema.js';
import { projectSettings } from '../../db/schema.js';

type Db = NodePgDatabase<typeof schema>;

export type ProjectSettingsRow = typeof projectSettings.$inferSelect;

export async function findOne(db: Db): Promise<ProjectSettingsRow | undefined> {
  const [row] = await db.select().from(projectSettings).limit(1);
  return row;
}

export async function deleteOne(db: Db): Promise<void> {
  await db.delete(projectSettings).where(eq(projectSettings.id, 1));
}

export async function createBootstrap(db: Db, adminUserId: string): Promise<void> {
  await db.insert(projectSettings).values({ id: 1, adminUserId });
}
