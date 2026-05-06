# Zero-Knowledge Encryption Model

The master password never leaves the browser. The key hierarchy (all derived/decrypted in-memory only):

```
Argon2id(masterPassword, kekSalt) → KEK
KEK → decrypt(encryptedMasterKey) → masterKey
masterKey → decrypt(encryptedVaultKey) → vaultKey
```

Server stores only ciphertext blobs. `packages/crypto` owns all primitives; `packages/vault` owns key derivation and vault/item encryption/decryption.
