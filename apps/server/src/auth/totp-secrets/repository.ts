import { eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../db/schema.js';
import { userTotpSecrets } from '../../db/schema.js';

type Db = NodePgDatabase<typeof schema>;

export async function replaceForUser(
  db: Db,
  userId: string,
  encryptedSecret: Buffer,
): Promise<void> {
  await db.delete(userTotpSecrets).where(eq(userTotpSecrets.userId, userId));
  await db.insert(userTotpSecrets).values({ userId, encryptedSecret });
}
