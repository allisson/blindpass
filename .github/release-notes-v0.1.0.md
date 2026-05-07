**Self-hostable, end-to-end encrypted password manager. Your secrets never leave your device unencrypted.**

BlindPass is architected so that the server is a cryptographically dumb blob store — it only ever sees ciphertext. Your master password is never sent over the network. Sign up with a username only; no email address, no phone number, nothing that ties your account to your real-world identity.

## Highlights

- **Zero-knowledge crypto** — Argon2id key derivation in-browser; keys exist in memory only and are zeroed on lock/logout
- **7 item types** — Logins, Secure Notes, Payment Cards, Identities, TOTP codes, Developer Credentials, and BIP39 Crypto Wallets
- **Vault sharing** — share vaults via X25519 asymmetric key sealing; the server never sees the vault key
- **Import** — bring in data from Bitwarden (JSON), LastPass (CSV), or Chrome (CSV)
- **No email required** — accounts are a username and a master password, nothing more
- **BIP39 recovery key** — generated at registration; use it to recover your account if you forget your password
- **Admin controls** — registration gate, user management, per-user vault/item quotas
- **4-container self-host** — webapp, server, PostgreSQL, Redis; prebuilt images, no build step required

## Self-Hosting (Docker Compose)

```bash
curl -o docker-compose.yml https://raw.githubusercontent.com/blindpass/blindpass/main/docker-compose.prod.yml
curl -o .env.example https://raw.githubusercontent.com/blindpass/blindpass/main/.env.example
cp .env.example .env
# Edit .env — set DATABASE_URL, TOTP_SECRET_ENCRYPTION_KEY, REDIS_URL, CORS_ORIGIN
docker compose up -d
```

The web app is available on port **8000**. Point a reverse proxy at it to terminate TLS.

The first account registered becomes the Admin user.

## Docker Images

```
docker pull allisson/blindpass-server:v0.1.0
docker pull allisson/blindpass-webapp:v0.1.0
```

## GCP Cloud Run (free tier)

Deploy on GCP Cloud Run + Supabase + Upstash — see [`terraform/README.md`](https://github.com/allisson/blindpass/blob/main/terraform/README.md) for the Terraform quickstart.

## What's Changed

See [CHANGELOG.md](https://github.com/allisson/blindpass/blob/main/CHANGELOG.md) for the full list of additions and infrastructure changes since the initial bootstrap.
