export interface EncryptedValue {
  ciphertext: Uint8Array;
  nonce: Uint8Array;
}

export interface KeyPair {
  publicKey: Uint8Array;
  privateKey: Uint8Array;
}

export interface Keychain {
  masterKey: Uint8Array;
  vaultKey: Uint8Array;
}
