# BlindPass

Zero-knowledge password manager. Encryption happens in the browser; the server stores only ciphertext, public keys, salts, and authentication state.

## Language

### Crypto & key hierarchy

**KEK** (Key Encryption Key):
A 32-byte symmetric key derived in the browser from the user's password via Argon2id with a per-user salt. Wraps the **MasterKey**. Never sent to the server.
_Avoid_: derived key, password key.

**MasterKey**:
The user's root 32-byte symmetric key. Wrapped by the **KEK** at rest and by the **RecoveryKey** as backup. Wraps **VaultKeys**.
_Avoid_: root key, account key.

**VaultKey**:
A 32-byte symmetric key that encrypts items inside one vault. Wrapped by the **MasterKey**. Sealed with a recipient's public key when shared.
_Avoid_: collection key.

**ItemKey**:
Per-item 32-byte symmetric key wrapped by the **VaultKey**. Encrypts the **VaultItem** payload.
_Avoid_: entry key, record key.

The KEK→MasterKey→VaultKey→ItemKey hierarchy lives in the names of variables and ceremony fns (`bootstrap`, `unlockWithPassword`, `rekey`); the encryption primitive itself is generic — `encryptSymmetric` / `decryptSymmetric` from `@blindpass/crypto`. There is no per-level wrapper fn (`encryptMasterKey` etc.) — the call-site arg names carry the role.

**RecoveryKey**:
A user-displayed mnemonic that derives a key wrapping a second copy of the **MasterKey** for emergency unlock. Validated server-side via the **RecoveryVerifier**.
_Avoid_: backup phrase (in code).

**EncryptedValue**:
The pair `{ciphertext, nonce}` — the at-rest representation of any sealed bytes. Every encrypted-at-rest field on the server has both columns.

**Keychain**:
The unlocked, in-memory set `{MasterKey, VaultKey(s), private signing key}` held by the browser session after a successful unlock. Never persisted, never sent to the server.

### Vault domain

**Vault**:
A named container of **VaultItems** owned by one user, optionally shared.

**VaultItem**:
One stored credential, fully decrypted. Type-discriminated payload: login, note, card, identity, TOTP, crypto wallet, dev credential. Lives in the browser only — the server never sees this shape. Defined in `packages/vault/src/item/schema.ts`.

**EncryptedVaultItem**:
The wire envelope for a **VaultItem** at rest and in transit: `{id, encryptedData, encryptedItemKey, folderId, createdAt, updatedAt}`. The server stores and returns this shape; it never sees the decrypted payload. Defined in `packages/api-schema/src/vault.ts`. Sibling envelopes: **EncryptedTrashedItem**, **EncryptedGlobalTrashedItem**.

### Server-side auth domain

**TotpEnrollment**:
The pair `{plaintextSecret, encryptedSecret}` produced when a user starts TOTP setup. The plaintext leaves the server exactly once (QR URI to client); the encrypted secret persists in the user row.
_Invariant_: TOTP secret is never plaintext at rest.

**TotpEnvelope**:
The AES-256-GCM ciphertext + IV + tag bundle that encrypts a TOTP secret on disk. Encrypted under the env-loaded `TOTP_SECRET_ENCRYPTION_KEY` (32 bytes).

**SessionIssuance**:
The atomic act of minting a session: random token in cookie, hashed token in DB row. Cookie and row must always be created together.

**RecoveryVerifier**:
The scrypt-hashed proof of a user's recovery answer, stored as `{hash, salt}`. Verified at recovery time without revealing the answer.

**AuthBundle**:
The client-bound response after successful auth — public key, KEK salt, and every **EncryptedValue** the browser needs to rebuild the **Keychain** (encrypted master key, encrypted private key, encrypted recovery copy).

### Browser keychain ceremonies

**Bootstrap**:
The registration ceremony. Generates **MasterKey**, first **VaultKey**, **RecoveryKey**, key pair; wraps everything; returns the body for `POST /auth/register` plus the in-memory keys. Zeros **KEK** and the local private-key copy before returning.

**UnlockWithPassword**:
The login/restore ceremony. Derives **KEK** from password + server salt, decrypts **MasterKey**, decrypts the private key. Used after `completeLogin` and on the unlock screen.

**UnlockWithRecovery**:
The recovery ceremony. Decrypts **MasterKey** with the **RecoveryKey** mnemonic, then decrypts the private key. First half of password reset.

**Rekey**:
The re-wrap ceremony. Given a held **MasterKey** and a new password, derives a new **KEK**, generates a new **RecoveryKey**, and produces fresh `{encryptedMasterKey, encryptedMasterKeyForRecovery, encryptedRecoveryKey}` for `POST /auth/recovery/complete`. Zeros the new **KEK** before returning.

## Relationships

- A user has one **KEK** salt → derives one **KEK** → wraps one **MasterKey** → wraps many **VaultKeys** → each wraps many **ItemKeys**.
- A **MasterKey** has two ciphertexts at rest: under the **KEK** and under the **RecoveryKey**.
- A **TotpEnrollment** produces one **TotpEnvelope**; verification decrypts the envelope and checks a counter against `lastUsedCounter` to prevent replay.
- A login completes by issuing a **SessionIssuance** and returning an **AuthBundle**.

### Server-side service layer

**UserRepository**:
Narrow drizzle queries against the `users` table. Returns row shapes (`typeof users.$inferSelect`-derived). Accepts `Db` (root `app.db` or a tx handle).

**AuthenticationService** (split by ceremony):

- **LoginService** (`auth/login/service.ts`) — `completeLogin`
- **RegistrationService** (`auth/registration/service.ts`) — `registerUser`, `completeRegistration`
- **RecoveryService** (`auth/recovery/service.ts`) — `verifyRecovery`, `completeRecovery`
- **AccountService** (`auth/account/service.ts`) — `changePassword`, `rotateRecoveryPhrase`, `deleteAccount`
- **TotpRotationService** (`auth/totp-rotation/service.ts`) — `startRotation`, `completeRotation`

**VaultItemsRepository** (`vaults/items/repository.ts`):
Hides the **VaultItem ↔ VaultItemVersion** pairing invariant — every item write produces both a `vaultItems` row and a `vaultItemVersions` row atomically. Exposes `createWithVersion`, `batchCreateWithVersion`, `updateWithNewVersion`, `softDelete`, `moveToFolder`, plus query helpers `findActiveByCursor`, `findChangedSince`, `findDeletedSince`.

**VaultItemsService** (`vaults/items/service.ts`):
Composes access check + quota + repo for each write ceremony: `createItem`, `batchCreateItems`, `updateItem`, `deleteItem`, `moveItem`. Read paths (list) skip the service and call repo + access helper directly.

**VaultsRepository** (`vaults/repository.ts`):
Vault-table queries: `createInitial`, `createVault`, `listOwnedByUser`, `listSharedWithUser`, `findOwnedById`, `updateMetadata`, `listIdsByOwner`.

**VaultsService** (`vaults/service.ts`):
`createVault` ceremony — checks owner quota, then inserts. Other vault ops (update, list) skip service.

**SharesRepository** + **SharesService** (`vaults/shares/`):
Repo: `listForVault`, `create`, `findByIdForUser`, `deleteById`. Service: `createShare` (self-share check + receiver lookup + insert), `deleteShare` (caller must be owner or receiver).

**TrashRepository** + **TrashService** (`vaults/trash/`):
Repo: `listForVault`, `listForUser`, `findTrashedById`, `restoreById`, `purgeById`, `emptyForVault`, `emptyForUser`. Service: `restoreItem` (writer access), `purgeItem` (owner only), `emptyVaultTrash` (owner only), `emptyUserTrash` (no access check needed — caller's own vaults).

**FoldersRepository** (`vaults/folders/repository.ts`):
`listForVault`, `create`, `update`, `deleteById`. No service — routes do access check inline.

**VersionsRepository** (`vaults/versions/repository.ts`):
`findItemInVault`, `listForItem`, `findById`. Read-only, repo-only.

**VaultAccess** (`vaults/access.ts`):
Per-request authorization check returning the caller's role on a vault: `owner`, `viewer`, or `editor`, or `null` if no access. Used as a guard in every vault route handler (and the items service).

**Quota** (`vaults/quota.ts`):
Per-user vault count and per-vault item count enforcement. Acquires a `pg_advisory_xact_lock` keyed on the resource before counting, so concurrent writes can't both pass under the limit. Throws `QuotaExceededError` (handled by the global error handler → 403).

Each service method takes `Db` and a typed input, returns a discriminated-union **ServiceResult** (`{ok: true, ...} | {ok: false, reason: ...}`). Routes own `db.transaction(...)` and HTTP shape; services own domain rules.

**ServiceResult**:
The discriminated-union return shape used by every auth service method. Routes pattern-match on `ok` and `reason` to choose status codes and error messages. Services never throw for expected validation failures; they return `{ok: false, reason}` instead.

## Flagged ambiguities

- "auth helpers" was used as a catch-all in `routes/auth/helpers.ts` — split into **TotpEnrollment**, **SessionIssuance**, **RecoveryVerifier**, **AuthBundle** modules.
- "secret" is ambiguous; prefer the specific term (**MasterKey**, **VaultKey**, **TotpEnrollment.plaintextSecret**, etc.) over bare "secret" in identifiers.
- `VaultItem` was used in both `@blindpass/api-schema` (server envelope) and `@blindpass/vault` (decrypted browser payload), forcing import-aliases like `VaultItem as VaultItemData` at call sites — resolved: api-schema renamed to **EncryptedVaultItem** / **EncryptedTrashedItem** / **EncryptedGlobalTrashedItem**; the unqualified **VaultItem** stays on the decrypted domain object.
