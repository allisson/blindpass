# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.8.0] - 2026-05-18

### Added

- "All Vaults" aggregate view — search and browse items across every vault you own or share, with a vault-color dot on each item indicating its source
- Per-vault deterministic color avatars in the vault picker and on items in the aggregate view
- Type filter — single-select pill below the folder row that filters the current list by item type; remembered across reloads, resets when you switch vaults

### Changed

- Vault sheet is now a pure vault picker; lock, sign out, theme, and admin moved to a dedicated "More options" menu
- Folder filter promoted from a horizontal scrolling strip to a dropdown button matching the new type-filter pattern

### Removed

- Command palette (`Cmd/Ctrl+K`) and the keyboard-shortcuts dialog — the type filter and folder dropdown cover the same flows from the touch UI. See [ADR-0007](docs/adr/0007-no-command-palette.md). `/` still focuses the search input.

### Internal

- `TxDb` branded type (`apps/server/src/db/tx.ts`) and `asTx()` cast. Every write-path service signature (auth, vaults, shares, trash, folders, items) and the `vaults/quota.ts` advisory-lock helpers now require `TxDb`, making accidental calls on `app.db` outside a transaction a compile error. Closes a latent correctness gap where `pg_advisory_xact_lock` would silently no-op without a surrounding transaction
- `FoldersService` (`apps/server/src/vaults/folders/service.ts`) extracted from inline route logic, mirroring the items / trash / shares service shape; folder write routes and the trash/list reader now run inside `db.transaction(...)`
- `requireOwner` / `requireWriter` / `requireReader` exports on `vaults/access.ts` consolidate the role-gate pattern previously duplicated in items and trash services and in folder routes
- `app.clock` Fastify decorator (`apps/server/src/plugins/clock.ts`) and `test/fake-clock.ts` helpers (`fixedClock`, `advanceableClock`) — session expiry, TOTP verify windows, recovery token expiry, the auth plugin's idle check, and the periodic cleanup interval all read time from `app.clock` so tests can control it without globally spying on `Date.now`
- `SessionProof` is now an opaque, branded type — the cookie-attach call can only consume a proof produced by `session.issue`, so a thrown insert cannot leave an orphan cookie on the response
- `useKeychain` is the single audit point for keychain access in the web app
- Duplicate PG `23505` try/catch removed from `routes/auth/register.ts` and `routes/vaults/shares/create-share.ts`; the global error handler is now the only place that maps unique-violation to 409
- Unit tests covering `vaults/access.ts` role-gate matrix, `FoldersService` write paths, the auth plugin's clock-driven idle ceiling, and `verifyRecovery`'s clock-driven expiry stamping
- Integration test app builder (`buildIntegrationApp`) now registers `clockPlugin` and the global `errorHandler` to match production wiring
- The credential-rotation integration test anchors its mocked clock at real wall-time instead of a far-future fixed date, so the auth plugin's idle check (which now reads `app.clock`) and Postgres `NOW()` (used for `sessions.last_used_at` default) agree within the idle window

## [0.7.0] - 2026-05-15

### Added

- Import support for 1Password (`.1pux`), Dashlane (zip bundle), Apple Keychain (CSV), KeePassXC (CSV), and Proton Pass (JSON)
- `ImportResult.attachmentsDropped` surfaces the count of file attachments that could not be carried over (BlindPass has no attachment storage); affected items get a `[Lost attachments: …]` breadcrumb in their notes/content
- Content-sniff format detection: parsers register a `signature` that inspects file shape, replacing the filename-extension-only heuristic

### Changed

- Bitwarden importer: items in unknown categories (including Bitwarden 2024.12+ SSH-key type 5 when fields are incomplete) coerce into a `secure_note` instead of being silently skipped; well-formed SSH keys map natively to `developer_credential` ssh_key mode
- CSV parser now correctly handles multi-line quoted fields and strips UTF-8 BOM, fixing silent corruption of notes with embedded newlines

### Fixed

- Selected vault is now visually distinct in the import and export pickers

## [0.6.0] - 2026-05-13

### Added

- Vault-aware import/export — export items from any vault and import into a specific vault directly from Settings

## [0.5.0] - 2026-05-13

### Added

- Cross-vault search — find items across all owned and shared vaults from a single search bar
- Real-time sync for shared vaults — changes made in shared vaults propagate automatically across sessions and devices
- Mobile-first shell — redesigned app shell optimised for mobile with a fortress-purple visual theme

## [0.4.1] - 2026-05-10

### Fixed

- Biometric unlock now shows a clear, actionable error card when the chosen passkey
  provider doesn't support PRF (e.g. Bitwarden or 1Password on Android). Users are
  told which providers work, how to delete the orphan credential, and that their
  master password is unaffected.

## [0.4.0] - 2026-05-10

### Added

- Biometric unlock — opt-in per-device unlock using Touch ID, Face ID, Windows Hello, or Android biometric via WebAuthn PRF. The master password still bootstraps each session; biometrics only unwrap a device-scoped key (see [ADR-0003](docs/adr/0003-biometric-unlock-via-webauthn-prf.md)).

## [0.3.0] - 2026-05-09

### Changed

- Repositioned README around "web-only by design" with a competitive comparison table; sharpened PRODUCT.md and AGENTS.md to drop browser-extension framing.

### Removed

- Browser extension scaffold (`apps/extension/`). Will not be pursued — see [ADR-0002](docs/adr/0002-no-browser-extension.md) for the security rationale (web-store supply chain, host-permission scope creep, MV3 cookie isolation).

## [0.2.1] - 2026-05-09

### Changed

- Settings split into focused sub-pages with a list-panel navigation
- Unlock now lives under the auth layout for a cleaner sign-in/lock flow
- Design system foundation in place (PRODUCT.md, DESIGN.md, shared tokens)

## [0.2.0] - 2026-05-08

### Changed

- Surface API errors to users — failed requests now show actionable error messages instead of failing silently
- Account deletion now happens in a two-step modal (consequence screen → TOTP) instead of a separate page

### Fixed

- Service worker auto-updates on deploy so users no longer hit a white screen from a stale CSP cache

## [0.1.0] - 2026-05-07

### Added

**Core**

- End-to-end encrypted vault — all encryption happens on-device; server stores only ciphertext
- Zero-knowledge architecture — master password never sent to the server, not even as a hash
- Argon2id key derivation in the browser; keys live in memory only and are zeroed on lock
- Layered key hierarchy: KEK → masterKey → vaultKey → itemKey → encrypted blob
- Multiple vaults per account with per-vault encryption keys

**Item types**

- Login items (username, password, URL, notes)
- Secure notes (encrypted freeform title + content)
- Payment cards (cardholder, number, expiry, CVV, notes)
- Identities (name, address, phone, email, company)
- TOTP authenticator entries (issuer, secret, algorithm, digits, period)
- Developer credentials (API tokens, client/secret pairs, SSH keypairs)
- Crypto wallets (BIP39 mnemonic seed phrases with optional network, derivation path, passphrase)

**Vault management**

- Vault sharing via asymmetric key sealing (X25519) — server never sees the vault key
- Encrypted export and import for backup and restore
- Import from Bitwarden (JSON), LastPass (CSV), and Chrome passwords (CSV)
- Item version history — view and restore previous versions of any item
- Trash and restore — deleted items are soft-deleted; permanently purge on demand

**Account**

- Passwordless signup — username only, no email address, no personal information collected
- Authenticator-based sign-in — username + TOTP; no password sent over the network
- BIP39 recovery key — 256-bit mnemonic generated at registration for account recovery
- Password change with full re-encryption of all key material under the new master password
- Session management — view all active sessions, revoke individual sessions remotely
- Account deletion — permanently removes account and all associated data

**Administration**

- Registration gate — admin can open or close sign-ups without affecting existing accounts
- User management — list users, revoke sessions, or delete accounts from the admin panel
- Vault and item quotas — default caps (10 vaults / 1,000 items) with per-user overrides
- Password strength gate — rejects weak master passwords using `zxcvbn` entropy scoring

### Infrastructure

- Production Docker Compose stack (webapp, server, migrate, Redis, PostgreSQL) with resource limits and health checks
- Multi-platform Docker images (linux/amd64, linux/arm64) published to Docker Hub on every push to main and on version tags
- Terraform module for GCP Cloud Run deployment (webapp + server as Cloud Run services) with Supabase and Upstash free-tier support
- GitHub Actions CI pipeline: lint, typecheck, format check, unit tests, and integration tests against a real PostgreSQL service
- Reverse proxy guides for Caddy and nginx (TLS termination + HTTP→HTTPS redirect)
- pnpm + Turborepo monorepo with isolated packages: `crypto`, `vault`, `api-schema`, `types`

[0.8.0]: https://github.com/allisson/blindpass/releases/tag/v0.8.0
[0.7.0]: https://github.com/allisson/blindpass/releases/tag/v0.7.0
[0.6.0]: https://github.com/allisson/blindpass/releases/tag/v0.6.0
[0.5.0]: https://github.com/allisson/blindpass/releases/tag/v0.5.0
[0.4.1]: https://github.com/allisson/blindpass/releases/tag/v0.4.1
[0.4.0]: https://github.com/allisson/blindpass/releases/tag/v0.4.0
[0.3.0]: https://github.com/allisson/blindpass/releases/tag/v0.3.0
[0.2.1]: https://github.com/allisson/blindpass/releases/tag/v0.2.1
[0.2.0]: https://github.com/allisson/blindpass/releases/tag/v0.2.0
[0.1.0]: https://github.com/allisson/blindpass/releases/tag/v0.1.0
