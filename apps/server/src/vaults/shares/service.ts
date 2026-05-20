import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { TxDb } from '../../db/tx.js';
import type * as schema from '../../db/schema.js';
import { requireOwner, type AccessFailure } from '../access.js';
import * as users from '../../auth/users/repository.js';
import * as vaults from '../repository.js';
import * as shares from './repository.js';
import type { ShareListRow } from './repository.js';

type Db = TxDb;
type ReadDb = NodePgDatabase<typeof schema>;

export type ListSharesResult =
  | { ok: true; shares: ShareListRow[] }
  | { ok: false; reason: AccessFailure };

export async function listShares(
  db: ReadDb,
  userId: string,
  vaultId: string,
  cursor: string | undefined,
  limit: number,
): Promise<ListSharesResult> {
  const accessFail = await requireOwner(db, vaultId, userId);
  if (accessFail) return { ok: false, reason: accessFail };
  const rows = await shares.listForVault(db, vaultId, cursor, limit);
  return { ok: true, shares: rows };
}

export type CreateShareInput = {
  receiverUserId: string;
  sealedVaultKey: Buffer;
  role: 'viewer' | 'editor';
};

export type CreatedShare = {
  id: string;
  receiverUserId: string;
  receiverUsername: string;
  role: 'viewer' | 'editor';
  createdAt: Date;
};

export type CreateShareResult =
  | { ok: true; share: CreatedShare }
  | { ok: false; reason: 'cannot_share_with_self' | 'vault_not_found' | 'receiver_not_found' };

export async function createShare(
  db: Db,
  ownerUserId: string,
  vaultId: string,
  input: CreateShareInput,
): Promise<CreateShareResult> {
  if (input.receiverUserId === ownerUserId) {
    return { ok: false, reason: 'cannot_share_with_self' };
  }

  const owned = await vaults.findOwnedById(db, vaultId, ownerUserId);
  if (!owned) return { ok: false, reason: 'vault_not_found' };

  const receiver = await users.findVerifiedById(db, input.receiverUserId);
  if (!receiver) return { ok: false, reason: 'receiver_not_found' };

  const inserted = await shares.create(db, {
    vaultId,
    ownerUserId,
    receiverUserId: input.receiverUserId,
    sealedVaultKey: input.sealedVaultKey,
    role: input.role,
  });

  return {
    ok: true,
    share: {
      id: inserted.id,
      receiverUserId: input.receiverUserId,
      receiverUsername: receiver.username,
      role: input.role,
      createdAt: inserted.createdAt,
    },
  };
}

export type DeleteShareResult = { ok: true } | { ok: false; reason: 'share_not_found' };

export async function deleteShare(
  db: Db,
  userId: string,
  vaultId: string,
  shareId: string,
): Promise<DeleteShareResult> {
  const found = await shares.findByIdForUser(db, shareId, vaultId, userId);
  if (!found) return { ok: false, reason: 'share_not_found' };
  await shares.deleteById(db, shareId);
  return { ok: true };
}
