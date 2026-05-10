import { describe, it, expect, beforeAll } from 'vitest';
import {
  generateKey,
  generateSalt,
  generateRecoveryKey,
  deriveKeyEncryptionKey,
  encryptSymmetric,
  encryptMasterKeyWithRecovery,
  CryptoError,
} from '@blindpass/crypto';
import {
  unlock,
  lock,
  unlockWithRecovery,
  unlockFromMasterKey,
  type ServerKeyData,
  type RecoveryKeyData,
} from '../index.js';

const TEST_PASSWORD = 'hunter2';
let sharedData: ServerKeyData;
let expectedMasterKey: Uint8Array;
let expectedVaultKey: Uint8Array;

beforeAll(async () => {
  const kekSalt = await generateSalt();
  const kek = await deriveKeyEncryptionKey(TEST_PASSWORD, kekSalt);
  expectedMasterKey = await generateKey();
  expectedVaultKey = await generateKey();
  const encryptedMasterKey = await encryptSymmetric(expectedMasterKey, kek);
  const encryptedVaultKey = await encryptSymmetric(expectedVaultKey, expectedMasterKey);
  sharedData = { kekSalt, encryptedMasterKey, encryptedVaultKey };
});

describe('unlock', () => {
  it('derives correct keys', async () => {
    const keychain = await unlock(sharedData, TEST_PASSWORD);
    expect(keychain.masterKey).toEqual(expectedMasterKey);
    expect(keychain.vaultKey).toEqual(expectedVaultKey);
  });

  it('throws CryptoError on wrong password', async () => {
    await expect(unlock(sharedData, 'wrong-password')).rejects.toThrow(CryptoError);
  });
});

describe('unlockWithRecovery', () => {
  let recoveryData: RecoveryKeyData;
  let recoveryMnemonic: string;
  let expectedMasterKey: Uint8Array;
  let expectedVaultKey: Uint8Array;

  beforeAll(async () => {
    const mnemonic = await generateRecoveryKey();
    recoveryMnemonic = mnemonic;
    expectedMasterKey = await generateKey();
    expectedVaultKey = await generateKey();
    const encryptedMasterKeyForRecovery = await encryptMasterKeyWithRecovery(
      expectedMasterKey,
      mnemonic,
    );
    const encryptedVaultKey = await encryptSymmetric(expectedVaultKey, expectedMasterKey);
    recoveryData = { encryptedMasterKeyForRecovery, encryptedVaultKey };
  });

  it('derives correct keys from recovery mnemonic', async () => {
    const keychain = await unlockWithRecovery(recoveryData, recoveryMnemonic);
    expect(keychain.masterKey).toEqual(expectedMasterKey);
    expect(keychain.vaultKey).toEqual(expectedVaultKey);
  });

  it('throws CryptoError on wrong mnemonic', async () => {
    const wrongMnemonic = await generateRecoveryKey();
    await expect(unlockWithRecovery(recoveryData, wrongMnemonic)).rejects.toThrow(CryptoError);
  });

  it('zeros masterKey and throws when encryptedVaultKey was encrypted with different masterKey', async () => {
    const mnemonic = await generateRecoveryKey();
    const masterKey = await generateKey();
    const encryptedMasterKeyForRecovery = await encryptMasterKeyWithRecovery(masterKey, mnemonic);

    const differentMasterKey = await generateKey();
    const vaultKey = await generateKey();
    const encryptedVaultKeyForDifferentMaster = await encryptSymmetric(
      vaultKey,
      differentMasterKey,
    );

    const badData: RecoveryKeyData = {
      encryptedMasterKeyForRecovery,
      encryptedVaultKey: encryptedVaultKeyForDifferentMaster,
    };

    await expect(unlockWithRecovery(badData, mnemonic)).rejects.toThrow(CryptoError);
  });
});

describe('unlockFromMasterKey', () => {
  it('derives vaultKey when given a masterKey directly', async () => {
    const keychain = await unlockFromMasterKey(
      { encryptedVaultKey: sharedData.encryptedVaultKey },
      expectedMasterKey,
    );
    expect(keychain.masterKey).toEqual(expectedMasterKey);
    expect(keychain.vaultKey).toEqual(expectedVaultKey);
  });

  it('throws CryptoError when masterKey does not match the encryptedVaultKey', async () => {
    const wrongMasterKey = await generateKey();
    await expect(
      unlockFromMasterKey({ encryptedVaultKey: sharedData.encryptedVaultKey }, wrongMasterKey),
    ).rejects.toThrow(CryptoError);
  });
});

describe('lock', () => {
  it('zeros all key material', async () => {
    const keychain = await unlock(sharedData, TEST_PASSWORD);
    await lock(keychain);
    expect(keychain.masterKey.every((b) => b === 0)).toBe(true);
    expect(keychain.vaultKey.every((b) => b === 0)).toBe(true);
  });
});
