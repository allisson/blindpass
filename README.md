# 🔐 BlindPass

[![CI](https://github.com/blindpass/blindpass/actions/workflows/ci.yml/badge.svg)](https://github.com/blindpass/blindpass/actions/workflows/ci.yml)
[![Node.js](https://img.shields.io/badge/node-24-brightgreen)](https://nodejs.org)
[![pnpm](https://img.shields.io/badge/pnpm-10-orange)](https://pnpm.io)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
[![Docker Server](https://img.shields.io/docker/v/allisson/blindpass-server?label=blindpass-server)](https://hub.docker.com/r/allisson/blindpass-server)
[![Docker Webapp](https://img.shields.io/docker/v/allisson/blindpass-webapp?label=blindpass-webapp)](https://hub.docker.com/r/allisson/blindpass-webapp)

**Self-hostable, end-to-end encrypted password manager built around privacy by design.** Your secrets never leave your device unencrypted — the server is a cryptographically dumb blob store that never sees plaintext. Sign up with a username only — no email address, no phone number, nothing that ties your account to your real-world identity.

Four containers (Web app, Server, PostgreSQL, Redis). MIT licensed. Small enough to audit in an afternoon.

---

## Contents

- [Why BlindPass?](#-why-blindpass)
- [Features](#-features)
- [How Encryption Works](#-how-encryption-works)
- [Security](#-security)
- [Self-Hosting](#-self-hosting)
- [Local Development](#-local-development)
- [Architecture](#-architecture)
- [Troubleshooting](#-troubleshooting)
- [Contributing](#-contributing)
- [License](#-license)

---

## 🤔 Why BlindPass?

Most password managers ask you to trust them with your most sensitive data. BlindPass is architected so that trust is unnecessary. Your secrets are encrypted on your device before anything leaves your browser — using keys derived from your master password that only you hold. Even if the server is breached, the database leaked, or the service legally compelled to hand over user data, there is nothing useful to give. The server stores only ciphertext — and that ciphertext is only as secure as your master password. That's why BlindPass enforces strong password requirements at registration: length, uppercase, digits, and special characters. The math protects you; a strong password makes it unbreakable.

Your master password never leaves your device — not even as a hash. Sign-in uses your immutable username plus an authenticator-app code; your password is used solely to derive encryption keys in your browser, via Argon2id, a memory-hard algorithm designed to resist brute-force at scale. Those keys exist only in memory and are zeroed the moment you lock your vault. There is no password database to breach, no hash to crack, no key material to exfiltrate.

BlindPass does not ask for your email address. Account creation requires only a username and a master password. There is no profile to harvest, no email address to breach, no identity to subpoena. Your account exists as an encrypted blob identified by a username you chose — nothing more.

BlindPass is MIT-licensed and self-hostable on four containers — your data lives on your infrastructure, under your control. And because the codebase is small enough to audit in an afternoon, you don't have to accept security claims on faith. Read the code. Verify the crypto. Run it yourself.

---

## ✨ Features

### Core

- 🔐 **End-to-end encrypted** — all encryption happens on your device; the server only stores ciphertext
- 🏠 **Self-hostable** — own your data, run on your own infrastructure
- 🗂 **Multiple vaults** — organize secrets into separate encrypted vaults

### Item types

- 🔑 **Login items** — username, password, URL, and notes
- 📝 **Secure notes** — encrypted freeform text (title + content)
- 💳 **Payment cards** — cardholder, number, expiry, CVV, and notes
- 🪪 **Identities** — name, address, phone, email, and company for form-filling
- ⏱ **TOTP authenticator** — issuer, secret, algorithm, digits, and period
- 🗝️ **Developer credentials** — API tokens, client/secret pairs, and SSH keypairs with structured metadata
- 🪙 **Crypto wallets** — BIP39 mnemonic seed phrases with optional network, derivation path, and passphrase

### Vault management

- 🔗 **Vault sharing** — share vaults with others via asymmetric key sealing
- 📤 **Encrypted export/import** — back up and restore your vault
- 📥 **Import from other managers** — Bitwarden (JSON), LastPass (CSV), or Chrome passwords (CSV)

### Account

- 🚫 **No email required** — accounts are identified by username only; no personal information is collected or stored
- 🗝 **Recovery key** — BIP39 mnemonic to regain access if you forget your password
- 🔢 **Authenticator-based sign-in** — username + TOTP for login and sensitive actions
- 🕐 **Version history** — view and restore previous versions of any item
- 🗑 **Trash & restore** — deleted items go to trash; restore or permanently purge them
- 🔄 **Password change** — re-encrypt all key material under a new master password
- 🖥 **Session management** — view all active sessions, revoke individual sessions remotely
- ❌ **Account deletion** — permanently delete your account and all associated data

### Administration

- 🛡 **Registration gate** — admin can open or close sign-ups without affecting existing accounts
- 👤 **User management** — list users, revoke sessions, or delete accounts from the admin panel
- 📊 **Vault & item quotas** — default caps (10 vaults / 1 000 items) with per-user overrides
- 💪 **Password strength gate** — registration rejects weak master passwords using `zxcvbn` entropy scoring; short or predictable passwords are blocked regardless of character composition

### Clients

- 🌐 **Web app** — access your vault anywhere from the browser
- 🧩 **Chrome extension** — _(planned)_

---

## 🔒 How Encryption Works

BlindPass is built on a **zero-knowledge architecture** — meaning we are technically incapable of reading your data, even if compelled to.

### Username + authenticator authentication

Sign-in uses a permanent username plus a 6-digit TOTP authenticator code. Your master password is never sent to the server — not even as a hash. It exists only in your browser, used solely to derive encryption keys.

### Login flow

```
Browser                                  Server
  │                                        │
  │  POST /auth/login/start { username }   │
  ├───────────────────────────────────────▶│  create login challenge state
  │                                        │
  │  POST /auth/login/complete             │
  │       { username, authenticatorCode }  │
  ├───────────────────────────────────────▶│  verify TOTP · create session
  │                                        │
  │◀─── 200 { message: "Authenticated" }
  │◀─── Set-Cookie: bp_session=…; HttpOnly; SameSite=Strict
  │                                        │
  │  GET /user/keys → encrypted key material
  │  Argon2id(password, kekSalt) → KEK
  │  decrypt(encryptedMasterKey) → masterKey  [memory only]
  │  decrypt(encryptedVaultKey)  → vaultKey   [memory only]
```

The session cookie is `HttpOnly` — JavaScript on the page cannot read it. The server stores only the SHA-256 hash of the token, never the token itself. On a page reload, you re-enter your master password to re-derive keys; no OTP is required.

### Your password never leaves your device

When you log in, BlindPass uses **Argon2id** — a memory-hard key derivation function designed to resist GPU and ASIC brute-force attacks — to derive a Key Encryption Key (KEK) from your master password. This derivation happens entirely in your browser. Your password is never sent over the network.

### A layered key hierarchy

Each layer of encryption uses a unique key, so compromising one layer doesn't expose another:

```
your password
  └─ Argon2id(password, kekSalt) → keyEncryptionKey (KEK)
       └─ decrypt(encryptedMasterKey) → masterKey
            ├─ decrypt(encryptedPrivateKey) → privateKey  (used for vault sharing)
            ├─ decrypt(encryptedRecoveryKey) → recoveryKey (BIP39 mnemonic)
            └─ decrypt(encryptedVaultKey) → vaultKey
                 └─ decrypt(encryptedItemKey) → itemKey
                      └─ decrypt(encryptedBlob) → your plaintext secret
```

All keys live **in memory only** and are zeroed out when you lock your vault or close the tab.

### What the server actually stores

| Stored on server (plaintext)             | Never stored on server  |
| ---------------------------------------- | ----------------------- |
| Username                                 | Your master password    |
| Public key (for vault sharing)           | Any plaintext secret    |
| KDF parameters (salt, Argon2id params)   | Vault keys or item keys |
| Encrypted key material (ciphertext only) | Your private key        |

### Vault sharing

To share a vault, the sender seals the vault key with the recipient's **X25519 public key**. The server looks up the recipient's public key by username. Only the intended recipient — holding the corresponding private key — can unseal and access the vault. The server cannot read the vault key at any point.

### Recovery key

At registration, BlindPass generates a **BIP39 mnemonic phrase** (256-bit entropy) and encrypts it under your master key. If you forget your password, use this phrase to regain access. It is shown once at account creation — store it somewhere safe and offline.

### Cryptographic primitives

All crypto uses **[libsodium](https://libsodium.org)**, a battle-tested, audited library:

- **Key derivation:** Argon2id
- **Symmetric encryption:** XSalsa20-Poly1305
- **Asymmetric encryption (vault sharing):** X25519 + XSalsa20-Poly1305
- **Recovery key:** BIP39 mnemonic (256-bit entropy)

---

## 🛡 Security

### Threat model

| Threat                        | Status          | Notes                                                                 |
| ----------------------------- | --------------- | --------------------------------------------------------------------- |
| Server compromise             | ✅ Protected    | Server stores only ciphertext — no keys, no plaintext                 |
| Network interception          | ✅ Protected    | All data encrypted client-side before transmission                    |
| Brute-force via server        | ✅ Protected    | No server-side password verifier or password hash to attack           |
| Weak master password          | ⚠️ Partial      | Argon2id hardens derivation; a weak password is still a weak password |
| Forgotten password            | ✅ Mitigated    | BIP39 recovery key generated at registration                          |
| Malware on your device        | ❌ Out of scope | Client-side malware can read in-memory keys                           |
| Phishing / social engineering | ❌ Out of scope | No technical control can prevent this                                 |

### Session security

| Property       | Value                                                          | Why it matters                                                                 |
| -------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Cookie flags   | `HttpOnly; Secure; SameSite=Strict`                            | JavaScript cannot read the session token; CSRF is blocked at the browser level |
| Server storage | SHA-256 hash of token only                                     | A database breach does not expose valid tokens                                 |
| CSRF defense   | `SameSite=Strict` + required `x-bp-client` header on mutations | Two independent layers; a weakened SameSite assumption alone is not enough     |
| Session TTL    | 14 days absolute, 7 days idle                                  | Both must hold; idle-only activity cannot extend indefinitely                  |

### What lives in your browser

BlindPass follows a strict client storage policy — key material is never written to disk, encrypted or not:

| Storage                      | What is stored                                   | When wiped                 |
| ---------------------------- | ------------------------------------------------ | -------------------------- |
| Memory only                  | `masterKey`, `vaultKey`, `itemKey`, `privateKey` | Lock, logout, or tab close |
| IndexedDB (`bp:vault-cache`) | Encrypted vault items (ciphertext only, no keys) | Lock and logout            |
| `localStorage`               | Username pre-fill, theme, density preference     | Never (non-sensitive)      |

An XSS attack that can run JavaScript in the page **cannot** read the session cookie, the master key, or any vault key. The worst it can do is read the IndexedDB cache — which is ciphertext.

---

## 🚀 Self-Hosting

### Requirements

- Docker and Docker Compose

### Setup

1. Download the compose file and configure:

   ```bash
   curl -o docker-compose.yml https://raw.githubusercontent.com/blindpass/blindpass/main/docker-compose.prod.yml
   curl -o .env.example https://raw.githubusercontent.com/blindpass/blindpass/main/.env.example
   cp .env.example .env
   ```

   Edit `.env` with your values (see the full variable reference below).

   > **Security:** The example `DATABASE_URL` uses the password `blindpass`. Change it before deploying to any non-local environment.

   Generate a base64 32-byte authenticator-secret key for the server:

   ```
   TOTP_SECRET_ENCRYPTION_KEY=$(openssl rand -base64 32)
   ```

2. Pull images and start all services:

   ```bash
   docker compose up -d
   ```

   No build step required — prebuilt images are pulled automatically from Docker Hub (`allisson/blindpass-server`, `allisson/blindpass-webapp`).

The web app is served on port **8000** (HTTP). Point a reverse proxy at that port to terminate TLS — see [docs/deployment/reverse-proxy.md](docs/deployment/reverse-proxy.md) for Caddy and nginx setup guides.

Verify the stack is running:

```bash
curl http://localhost:8000/health
# {"status":"ok","db":"ok"}
```

### First-time setup

Open the web app and register an account. **The first registration always becomes the Admin User**, regardless of whether the registration gate is open or closed.

As admin, visit `/admin` to:

- Open or close the **registration gate** — controls whether new users can sign up
- View and revoke user access
- Adjust default quotas (defaults: 10 vaults per user, 1 000 items per vault)

### Updating

```bash
docker compose pull
docker compose up -d
```

### Environment Variables

| Variable                     | Required   | Default                 | Description                                                            |
| ---------------------------- | ---------- | ----------------------- | ---------------------------------------------------------------------- |
| `DATABASE_URL`               | Yes        | —                       | PostgreSQL connection URL                                              |
| `TOTP_SECRET_ENCRYPTION_KEY` | Yes        | —                       | Base64-encoded 32-byte key for encrypting stored authenticator secrets |
| `REDIS_URL`                  | Yes (prod) | —                       | Redis connection URL for server-side session storage                   |
| `PORT`                       | No         | `3000`                  | HTTP server port                                                       |
| `CORS_ORIGIN`                | Yes (prod) | `http://localhost:5173` | Allowed origin(s), comma-separated                                     |
| `COOKIE_DOMAIN`              | No         | —                       | Cookie domain (set when web app and API share a domain)                |
| `COOKIE_SECURE`              | No         | `true`                  | Must remain `true` in production                                       |
| `LOG_LEVEL`                  | No         | `info`                  | Pino log level (`trace`/`debug`/`info`/`warn`/`error`)                 |

---

## 🛠 Local Development

### Requirements

- Node.js 24
- pnpm 10
- Docker (for PostgreSQL)

### Setup

```bash
pnpm install
make dev
```

`make dev` starts PostgreSQL via Docker Compose and runs all apps in watch mode.

| Service    | URL                   |
| ---------- | --------------------- |
| Web app    | http://localhost:5173 |
| API server | http://localhost:3000 |

### Commands

```bash
make dev                      # start all services and apps
make test                     # run all tests
make test:crypto              # packages/crypto only (≥95% coverage gate)
make test:server:unit         # server unit tests
make test:server:integration  # server integration tests (requires Docker)
make lint                     # eslint + tsc
make format                   # prettier --write
make ci                       # full CI check (lint + format + test)
make db:migrate               # run pending migrations
make db:studio                # open Drizzle Studio
make screenshots              # capture UI screenshots to docs/screenshots/
make prod:build               # build production Docker images (contributors only)
make prod:up                  # start production stack
make prod:down                # stop production stack
make prod:logs                # tail production logs
```

---

## 🏗 Architecture

BlindPass is a pnpm monorepo. The zero-knowledge design is modeled after [Ente's published E2EE architecture](https://ente.io/architecture).

```
┌──────────────────────────────────────────────┐
│                   Browser                    │
│  ┌──────────────┐   ┌────────────────────┐   │
│  │   apps/web   │   │  apps/extension    │   │
│  │              │   │    (planned)       │   │
│  └──────┬───────┘   └────────┬───────────┘   │
│         └──────────┬─────────┘               │
│           ┌────────▼────────┐                │
│           │ packages/vault  │◄── packages/   │
│           │ (domain logic)  │    crypto      │
│           └────────┬────────┘                │
└────────────────────┼────────────────────────┘
                     │ HTTPS (encrypted blobs only)
              ┌──────▼──────┐
              │ apps/server │  Fastify REST API
              └──────┬──────┘
              ┌──────▼──────┐
              │  PostgreSQL │  stores only ciphertext
              └─────────────┘
```

### Packages

| Package               | Role                                                                                                                                                                   |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/crypto`     | Pure libsodium primitives — Argon2id, XSalsa20-Poly1305, X25519, BIP39. No I/O, no state, no side effects.                                                             |
| `packages/vault`      | Domain logic — encrypts/decrypts items, manages the keychain lifecycle (unlock/lock), handles vault sharing. Imports only from `packages/crypto` and `packages/types`. |
| `packages/api-schema` | Zod schemas for every API endpoint, shared between server and clients so validation stays in sync.                                                                     |
| `packages/types`      | TypeScript interfaces only (`EncryptedValue`, `KeyPair`, `Keychain`). No runtime code.                                                                                 |

### Tech Stack

| Layer    | Technology                                                         |
| -------- | ------------------------------------------------------------------ |
| Runtime  | Node.js 24, pnpm 10                                                |
| Backend  | Fastify, Drizzle ORM, PostgreSQL 16                                |
| Frontend | React 19, TanStack Router, Vite, Tailwind, shadcn/ui               |
| Crypto   | libsodium-wrappers-sumo, @scure/bip39                              |
| Testing  | Vitest (unit + integration), real PostgreSQL for integration tests |
| Build    | Turborepo, Vite, esbuild                                           |

---

## 🛟 Troubleshooting

**`make dev` fails immediately**
Docker must be running before starting. Start Docker Desktop (or your Docker daemon) and retry.

**Port 5432 already in use**
A local PostgreSQL instance is occupying the port. Stop it (`brew services stop postgresql` on macOS) or change the mapped port in `docker-compose.yml`.

**`make test:server:integration` fails**
Integration tests require Docker to be running (they spin up a real PostgreSQL container). Ensure Docker is available and no other process holds port 5432.

**`libsodium` import errors in tests**
`packages/crypto` must never be mocked. Always run tests against the real libsodium binding. If you see import errors, verify `libsodium-wrappers-sumo` is installed (`pnpm install`).

---

## 🤝 Contributing

1. Fork the repo and create a branch from `main`
2. Run `make ci` before opening a PR (lint + type check + tests must pass)
3. All new code requires tests written alongside or before implementation (TDD)
4. `packages/crypto` enforces ≥95% coverage — do not drop below it
5. Never mock `packages/crypto` in tests — always test against real libsodium

---

## 📄 License

MIT — see [LICENSE](LICENSE).
