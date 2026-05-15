import { eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../db/schema.js';
import { userTotpSecrets, users } from '../../db/schema.js';
import type { Clock } from '../../plugins/clock.js';
import { verify } from './index.js';

type Db = NodePgDatabase<typeof schema>;

export async function verifyAuthenticatorForUser(
  db: Db,
  userId: string,
  authenticatorCode: string,
  clock: Clock,
): Promise<number | null> {
  const [row] = await db
    .select({
      encryptedSecret: userTotpSecrets.encryptedSecret,
      lastUsedCounter: users.totpLastUsedCounter,
    })
    .from(userTotpSecrets)
    .innerJoin(users, eq(users.id, userTotpSecrets.userId))
    .where(eq(userTotpSecrets.userId, userId))
    .limit(1);

  if (!row) return null;
  return verify(row.encryptedSecret, authenticatorCode, row.lastUsedCounter, clock.now());
}
