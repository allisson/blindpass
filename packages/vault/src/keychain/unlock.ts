import {
  getSodium,
  deriveKeyEncryptionKey,
  decryptSymmetric,
  decryptMasterKeyWithRecovery,
  type EncryptedValue,
  type Keychain,
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

export type MasterKeyData = {
  encryptedVaultKey: EncryptedValue;
};

export async function unlockFromMasterKey(
  data: MasterKeyData,
  masterKey: Uint8Array,
): Promise<Keychain> {
  const vaultKey = await decryptSymmetric(data.encryptedVaultKey, masterKey);
  return { masterKey, vaultKey };
}

export async function unlock(data: ServerKeyData, password: string): Promise<Keychain> {
  const sodium = await getSodium();
  const kek = await deriveKeyEncryptionKey(password, data.kekSalt);
  try {
    const masterKey = await decryptSymmetric(data.encryptedMasterKey, kek);
    return await unlockFromMasterKey(data, masterKey);
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
    return await unlockFromMasterKey(data, masterKey);
  } catch (err) {
    sodium.memzero(masterKey);
    throw err;
  }
}
