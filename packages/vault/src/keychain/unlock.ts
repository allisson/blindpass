import type { EncryptedValue, Keychain } from '@blindpass/types';
import {
  getSodium,
  deriveKeyEncryptionKey,
  decryptSymmetric,
  decryptMasterKeyWithRecovery,
} from '@blindpass/crypto';

export type ServerKeyData = {
  kekSalt: Uint8Array;
  encryptedMasterKey: EncryptedValue;
  encryptedVaultKey: EncryptedValue;
};

export type RecoveryKeyData = {
  encryptedMasterKeyForRecovery: EncryptedValue;
  encryptedVaultKey: EncryptedValue;
};

export async function unlock(data: ServerKeyData, password: string): Promise<Keychain> {
  const sodium = await getSodium();
  const kek = await deriveKeyEncryptionKey(password, data.kekSalt);
  try {
    const masterKey = await decryptSymmetric(data.encryptedMasterKey, kek);
    const vaultKey = await decryptSymmetric(data.encryptedVaultKey, masterKey);
    return { masterKey, vaultKey };
  } finally {
    sodium.memzero(kek);
  }
}

export async function unlockWithRecovery(
  data: RecoveryKeyData,
  recoveryMnemonic: string,
): Promise<Keychain> {
  const sodium = await getSodium();
  const masterKey = await decryptMasterKeyWithRecovery(
    data.encryptedMasterKeyForRecovery,
    recoveryMnemonic,
  );
  try {
    const vaultKey = await decryptSymmetric(data.encryptedVaultKey, masterKey);
    return { masterKey, vaultKey };
  } catch (err) {
    sodium.memzero(masterKey);
    throw err;
  }
}
