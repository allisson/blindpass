import { toB64 } from '../../utils/base64.js';

export type UserRowForBundle = {
  publicKey: Buffer | null;
  kekSalt: Buffer | null;
  encryptedMasterKeyCiphertext: Buffer | null;
  encryptedMasterKeyNonce: Buffer | null;
  encryptedMasterKeyForRecoveryCiphertext: Buffer | null;
  encryptedMasterKeyForRecoveryNonce: Buffer | null;
  encryptedPrivateKeyCiphertext: Buffer | null;
  encryptedPrivateKeyNonce: Buffer | null;
  encryptedRecoveryKeyCiphertext: Buffer | null;
  encryptedRecoveryKeyNonce: Buffer | null;
};

export function fromUserRow(user: UserRowForBundle) {
  return {
    publicKey: toB64(user.publicKey),
    kekSalt: toB64(user.kekSalt),
    encryptedMasterKey: {
      ciphertext: toB64(user.encryptedMasterKeyCiphertext),
      nonce: toB64(user.encryptedMasterKeyNonce),
    },
    encryptedMasterKeyForRecovery: {
      ciphertext: toB64(user.encryptedMasterKeyForRecoveryCiphertext),
      nonce: toB64(user.encryptedMasterKeyForRecoveryNonce),
    },
    encryptedPrivateKey: {
      ciphertext: toB64(user.encryptedPrivateKeyCiphertext),
      nonce: toB64(user.encryptedPrivateKeyNonce),
    },
    encryptedRecoveryKey: {
      ciphertext: toB64(user.encryptedRecoveryKeyCiphertext),
      nonce: toB64(user.encryptedRecoveryKeyNonce),
    },
  };
}
