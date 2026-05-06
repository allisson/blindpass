import { eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type * as schema from '../../db/schema.js';
import { userTotpSecrets, users } from '../../db/schema.js';
import { decryptTotpSecret, verifyTotpCode } from '../auth/helpers.js';

export async function verifyAuthenticatorForUser(
  db: NodePgDatabase<typeof schema>,
  userId: string,
  authenticatorCode: string,
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
  return verifyTotpCode(
    decryptTotpSecret(row.encryptedSecret),
    authenticatorCode,
    row.lastUsedCounter,
  );
}
