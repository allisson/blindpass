import type { TxDb } from '../db/tx.js';
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

export async function createVault(
  db: Db,
  userId: string,
  input: CreateVaultInput,
): Promise<VaultRow> {
  const limit = await getEffectiveOwnerQuota(db, userId);
  await assertVaultQuota(db, userId, limit);
  return vaults.createVault(db, { userId, ...input });
}
