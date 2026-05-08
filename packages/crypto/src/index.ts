export { CryptoError } from './errors.js';
export { getSodium } from './lib/sodium.js';
export { deriveKeyEncryptionKey } from './lib/kdf.js';
export { encryptSymmetric, decryptSymmetric } from './lib/symmetric.js';
export { generateKeyPair, sealBox, openSealBox } from './lib/asymmetric.js';
export { generateKey, generateNonce, generateSalt } from './lib/random.js';
export {
  generateRecoveryKey,
  encryptRecoveryKey,
  decryptRecoveryKey,
  encryptMasterKeyWithRecovery,
  decryptMasterKeyWithRecovery,
} from './keys/recovery.js';
export { generateTotpCode, getTotpTimeRemaining } from './lib/totp.js';
export type { TotpOptions } from './lib/totp.js';
export { verificationId } from './lib/verification.js';
