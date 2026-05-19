import type { TxDb } from '../db/tx.js';
import { requireOwner } from './access.js';
import type { AccessFailure } from './access.js';
import { assertVaultQuota, getEffectiveOwnerQuota } from './quota.js';
import * as vaults from './repository.js';
import type { VaultRow } from './repository.js';

type Db = TxDb;

export type CreateVaultInput = {
  encryptedVaultKeyCiphertext: Buffer;
  encryptedVaultKeyNonce: Buffer;
  encryptedVaultDataCiphertext: Buffer;
  encryptedVaultDataNonce: Buffer;
};

export type DeleteVaultResult = { ok: true } | { ok: false; reason: AccessFailure | 'last_vault' };

export async function deleteVault(
  db: Db,
  userId: string,
  vaultId: string,
): Promise<DeleteVaultResult> {
  const fail = await requireOwner(db, vaultId, userId);
  if (fail) return { ok: false, reason: fail };

  const owned = await vaults.listIdsByOwner(db, userId);
  if (owned.length <= 1) return { ok: false, reason: 'last_vault' };

  await vaults.deleteById(db, vaultId);
  return { ok: true };
}

export async function createVault(
  db: Db,
  userId: string,
  input: CreateVaultInput,
): Promise<VaultRow> {
  const limit = await getEffectiveOwnerQuota(db, userId);
  await assertVaultQuota(db, userId, limit);
  return vaults.createVault(db, { userId, ...input });
}
