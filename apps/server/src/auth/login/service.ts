import type { TxDb } from '../../db/tx.js';
import type { Clock } from '../../plugins/clock.js';
import { verifyAuthenticatorForUser } from '../totp/verify-for-user.js';
import * as session from '../session/index.js';
import * as users from '../users/repository.js';

export type CompleteLoginInput = {
  username: string;
  authenticatorCode: string;
  userAgent: string | undefined;
};

export type CompleteLoginFailure = 'invalid_credentials';
export type CompleteLoginResult =
  | { ok: true; proof: session.ProofOfSession }
  | { ok: false; reason: CompleteLoginFailure };

export async function completeLogin(
  db: TxDb,
  input: CompleteLoginInput,
  clock: Clock,
): Promise<CompleteLoginResult> {
  const user = await users.findCredentialsByUsername(db, input.username);
  if (!user || !user.verified || user.revokedAt) {
    return { ok: false, reason: 'invalid_credentials' };
  }

  const counter = await verifyAuthenticatorForUser(db, user.id, input.authenticatorCode, clock);
  if (counter == null) {
    return { ok: false, reason: 'invalid_credentials' };
  }

  await users.updateTotpCounter(db, user.id, counter);
  const proof = await session.issue(db, user.id, input.userAgent, clock);
  return { ok: true, proof };
}
