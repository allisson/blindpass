import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../db/schema.js';
import { verifyAuthenticatorForUser } from '../totp/verify-for-user.js';
import * as session from '../session/index.js';
import * as users from '../users/repository.js';

type Db = NodePgDatabase<typeof schema>;

export type CompleteLoginInput = {
  username: string;
  authenticatorCode: string;
  userAgent: string | undefined;
};

export type CompleteLoginResult =
  | { ok: true; authToken: string }
  | { ok: false; reason: 'invalid_credentials' };

export async function completeLogin(
  db: Db,
  input: CompleteLoginInput,
): Promise<CompleteLoginResult> {
  const user = await users.findCredentialsByUsername(db, input.username);
  if (!user || !user.verified || user.revokedAt) {
    return { ok: false, reason: 'invalid_credentials' };
  }

  const counter = await verifyAuthenticatorForUser(db, user.id, input.authenticatorCode);
  if (counter == null) {
    return { ok: false, reason: 'invalid_credentials' };
  }

  await users.updateTotpCounter(db, user.id, counter);
  const authToken = await session.issue(db, user.id, input.userAgent);
  return { ok: true, authToken };
}
