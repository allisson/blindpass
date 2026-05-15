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

**BUK** (Biometric Unlock Key):
A 32-byte secret derived per-device from a WebAuthn credential's `prf` extension. Computed as `prf(credentialId, prfSalt)` by the chosen **Passkey provider**, gated by the platform authenticator's user verification (Touch ID / Face ID / Windows Hello / Android biometric). Wraps **MasterKey** at rest in the device's local IndexedDB. Never leaves the device, never sent to the server, regenerated on each unlock from the credential — not persisted itself. The trust root is the chosen **Passkey provider**'s key handling, not "the device biometric" abstractly.

**BiometricEnrollment**:
The IndexedDB record `{version, username, credentialId, prfSalt, encryptedMasterKey, rpId, createdAt, label?}` produced when a user opts into **Biometric unlock** on a device. Stored in `bp:biometric-unlock`. Created on settings opt-in while the vault is unlocked. Cleared on explicit disenrollment or `session.clear()` (logout / session_expired). Survives `session.lock()` and password rotation (because **MasterKey** survives both).

**Passkey provider**:
On Android, the app or service the user picks in Credential Manager to store and present passkeys (Google Password Manager, Bitwarden, 1Password, Samsung Pass, …). Each provider implements its own subset of WebAuthn extensions; BlindPass requires **PRF**, which currently only **Google Password Manager** exposes — third-party providers accept the create and store the passkey, but return `getClientExtensionResults().prf.enabled === false`. iOS / macOS funnel through iCloud Keychain (no equivalent fan-out); Windows uses Windows Hello directly. Provider selection happens during the WebAuthn ceremony, not before — `probePrfSupport()` cannot predict it. See `docs/agents/biometric-compat.md`.

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
The wire envelope for a **VaultItem** at rest and in transit: `{id, encryptedData, encryptedItemKey, folderId, createdAt, updatedAt}`. The server stores and returns this shape; it never sees the decrypted payload. Defined in `packages/api-schema/src/vault.ts`. Sibling envelopes: **EncryptedTrashedItem**, **EncryptedGlobalTrashedItem**, **EncryptedGlobalVaultItem**.

**EncryptedGlobalVaultItem**:
`EncryptedVaultItem` extended with `vaultId`. Returned by `GET /user/items` — the user-scoped endpoint that loads active items from all owned and shared vaults in one request. The client needs `vaultId` to select the correct **VaultKey** for decryption. Analogous to **EncryptedGlobalTrashedItem**.

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

**Biometric unlock**:
The alternative to **UnlockWithPassword** that recovers **MasterKey** from a local **BiometricEnrollment** by deriving a **BUK** via WebAuthn PRF and decrypting `encryptedMasterKey`. Replaces only the vault-unlock step; the server `bp_session` cookie and TOTP login are unchanged. Available only when a **BiometricEnrollment** exists for `getLastUsername()` on this device and the platform supports the `prf` extension.

**Rekey**:
The re-wrap ceremony. Given a held **MasterKey** and a new password, derives a new **KEK**, generates a new **RecoveryKey**, and produces fresh `{encryptedMasterKey, encryptedMasterKeyForRecovery, encryptedRecoveryKey}` for `POST /auth/recovery/complete`. Zeros the new **KEK** before returning.

### Browser VaultItem editor

**VaultItemFieldsComponent**:
The per-type editor module for one **VaultItem** discriminator (login, secure_note, payment_card, identity, totp, developer_credential, crypto_wallet). Lives under `components/vault/item-fields/<Type>Fields.tsx`. Owns its type-specific fields, validation, and any local reveal/mode-switch UI. Reads RHF methods through `useFormContext()` so the outer shell doesn't prop-drill.

**VaultItemFieldsRegistry**:
The `Record<VaultItem['type'], {schema, Component}>` map exported from `components/vault/item-fields/index.ts`. The outer **ItemForm** shell looks up the active type and renders the registered component inside a `FormProvider`. Schemas are imported from `@blindpass/vault` so the wire schema stays the source of truth.

### Browser ceremony plumbing

**CeremonyPhase**:
The typed step a browser keychain ceremony reports while running: `'idle' | 'fetching_keys' | 'deriving_kek' | 'decrypting' | 'finalizing' | 'done' | 'error'`. UI labels are derived from the phase, not from free-form messages. Lets KDF progress and network steps be distinguished without each route re-inventing copy.

**CeremonyError**:
The discriminated-union error returned by every browser keychain ceremony hook. Shape: `{code: 'wrong_password' | 'session_expired' | 'network' | 'no_vault' | 'kdf_failed' | 'unknown', message: string, cause?: unknown}`. Routes pattern-match on `code` for UX (re-prompt vs redirect to `/login` vs toast). Mirrors the server-side **ServiceResult** intent on the client.

**runCeremony**:
The shared core that wraps every **UnlockWithPassword**, **UnlockWithRecovery**, and **Rekey** hook. Owns phase transitions, **CeremonyError** mapping, key zeroing on failure, and the final `session.set` write on success. Accepts injected `{api, primitives}` so tests substitute fakes without mocking modules.

### Browser mutation builder

**useOptimisticListMutation**:
The hook wrapper used by every browser mutation that touches a list-shaped query (e.g. `vaultItems`, `trashItems`). Caller declares `{queryKey, patch: {kind: 'append' | 'updateById' | 'removeById', ...}, mutationFn, errorMessage?, syncOnSuccess?}`; wrapper composes optimistic apply → rollback → toast → invalidate → **SyncBoundary** `forceSync`. One audit point for the optimistic UX contract.

### Browser keychain access

**KeychainRequired**:
The React context boundary mounted inside `_vault/route.tsx` that gates every authenticated subtree on a hot **Keychain**. If `session.get()?.keychain` is `null` at mount or becomes `null` mid-render, the boundary redirects to `/unlock`; otherwise it provides the unwrapped Keychain via `useKeychain()`. Children type the Keychain as non-null and never have to re-check.

**useKeychain**:
The hook exposed by **KeychainRequired**. Returns the held `{vaultKey, keyPair, vaults}` plus the helpers `decryptItem(envelope)`, `decryptVersion(envelope)`, `encryptItem(payload)`, `getVaultKey(vaultId)`, and `wrapVaultKey(vaultKey)`. Single audit point for: (a) any envelope that wraps an item key under a **VaultKey** — current **EncryptedVaultItem**, **EncryptedGlobalTrashedItem**, **VersionDetail**; (b) wrapping a fresh **VaultKey** under the **MasterKey**; (c) intermediate item-key memory hygiene. `masterKey` is intentionally omitted from the returned value — consumers that legitimately need it (ceremonies in `lib/keychain/*`, **BUK** wrapping in `lib/biometric/buk.ts`, `useChangePassword`) read it from `session.get().keychain` or receive it as a parameter. **EncryptedExport** passphrase crypto (ADR-0005) is also outside the seam by design.

**CachedVaultItem**:
The IndexedDB-at-rest shape for an **EncryptedVaultItem**. Same fields as the wire envelope; distinct name signals intent (cache vs network). Lives in `lib/vaultCache.ts`. Cleared on `session.lock()` and `session.clear()` — ciphertext never outlives the keychain that can read it.

### Browser data portability

**PlaintextExport**:
The unencrypted `.json` export envelope: `{version: 1, type: 'blindpass-export', exportedAt, items: VaultItem[]}`. Defined in `packages/vault/src/export/index.ts`. The one place where decrypted **VaultItem** data intentionally leaves the browser as readable JSON — explicitly authorised by the user.
_Avoid_: plaintext backup, JSON export.

**EncryptedExport**:
The passphrase-protected `.blindpass` export envelope: `{version: 1, type: 'blindpass-export-encrypted', kekSalt, nonce, ciphertext}`. Wraps a serialised **PlaintextExport** encrypted under a passphrase-derived key (independent of the account **Keychain**). Defined in `packages/vault/src/export/index.ts`.
_Avoid_: encrypted backup, secure export.

**ImportFormat**:
The discriminated union `'chrome' | 'lastpass' | 'bitwarden' | 'blindpass' | '1password' | 'dashlane' | 'apple-keychain' | 'keepassxc' | 'protonpass'` that selects the parse path when importing items. Defined in `apps/web/src/lib/import/types.ts`.

**CategoryCoercion**:
The policy that any source item whose category does not map to one of BlindPass's seven item types becomes a **SecureNote** with a `[Source Category] ` title prefix; source-specific fields land in `customFields`. Lets importers preserve data fidelity without growing the item taxonomy.
_Avoid_: bucket dump, fallback note.

### Browser sync

**SyncEngine**:
The pluggable adapter that performs one round of user-scoped synchronisation: pulls **EncryptedGlobalVaultItem** changes across all owned and shared vaults since the last cursor, updates `vaultCache`. Pure I/O; no React. Exposes `runOnce()` (no `vaultId` — sync is always user-scoped), `subscribe(listener)`, and emits typed `SyncEvent`s (`started`, `succeeded`, `failed`, `offline`) — none carry `vaultId`.
_Avoid_: syncer, sync service.

**SyncBoundary**:
The React context provider mounted inside `_vault/route` that owns one **SyncEngine** lifecycle and surfaces sync state to the layout. Triggers a run on mount, on interval, on window focus, and after each successful **VaultItem** mutation (squash-merged). Exposes `{phase: 'idle' | 'syncing' | 'error', lastError, pendingItemIds: Set<string>, lastSyncedAt, forceSync(), markPending(id), clearPending(id)}`. Retries failed runs with capped exponential backoff; toast surfaces single failures, persistent banner surfaces stuck state. Tests substitute a fake **SyncEngine** through the provider's `engine` prop.
_Avoid_: SyncProvider (the term is **SyncBoundary**; the React component happens to be a provider).

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
Hides the **VaultItem ↔ VaultItemVersion** pairing invariant — every item write produces both a `vaultItems` row and a `vaultItemVersions` row atomically. Exposes `createWithVersion`, `batchCreateWithVersion`, `updateWithNewVersion`, `softDelete`, `moveToFolder`, plus per-vault query helpers `findActiveByCursor`, `findChangedSince`, `findDeletedSince` and user-scoped helpers `findActiveForUser`, `findChangedSinceForUser`, `findDeletedSinceForUser`.

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
