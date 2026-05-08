export { ExportError } from './errors.js';
export {
  VaultItemSchema,
  LoginItemSchema,
  SecureNoteSchema,
  PaymentCardSchema,
  IdentitySchema,
  TotpItemSchema,
  DeveloperCredentialItemSchema,
  CryptoWalletItemSchema,
  CustomFieldSchema,
  type VaultItem,
  type LoginItem,
  type SecureNote,
  type PaymentCard,
  type Identity,
  type TotpItem,
  type DeveloperCredentialItem,
  type CryptoWalletItem,
  type CustomField,
} from './item/schema.js';
export { encryptVaultItem } from './item/encrypt.js';
export { decryptVaultItem } from './item/decrypt.js';
export {
  unlock,
  unlockWithRecovery,
  type ServerKeyData,
  type RecoveryKeyData,
} from './keychain/unlock.js';
export { lock } from './keychain/lock.js';
export { encryptVaultMetadata, decryptVaultMetadata, type VaultMetadata } from './metadata.js';
export { encryptFolderName, decryptFolderName } from './folder/encrypt.js';
export {
  exportVaultPlaintext,
  exportVaultEncrypted,
  importVaultPlaintext,
  importVaultEncrypted,
} from './export/index.js';
