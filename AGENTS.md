# AGENTS.md

pnpm + Turborepo monorepo. Node.js ≥24, pnpm ≥10.

## Commands

```bash
make dev                       # start Docker services + all apps (turbo dev)
make test                      # run all tests via turbo
make test:crypto               # packages/crypto only (≥95% coverage gate)
make test:server:unit          # server unit tests (no Docker required)
make test:server:integration   # server integration tests (requires Docker)
make lint                      # eslint via turbo
make format                    # prettier --write
make ci                        # lint + tsc -b + format:check + test (full CI)
make db:migrate                # generate + run pending Drizzle migrations
make db:studio                 # open Drizzle Studio
```

## Repository structure

```
apps/
  server/      Fastify 5 REST API (TypeScript)
  web/         React 19, TanStack Router, Vite, Tailwind, shadcn/ui
packages/
  api-schema/  Zod schemas shared between server and clients
  crypto/      libsodium-wrappers-sumo primitives + Argon2id key derivation
  vault/       domain logic — vault/item operations, keychain management
```

## Detail docs

- [Server architecture](docs/agents/server-architecture.md) — entry point, plugins, routes, validation, error handler, env
- [Auth & session model](docs/agents/auth-session.md) — TOTP, session cookie, CSRF, Bearer token
- [Zero-knowledge crypto model](docs/agents/crypto-model.md) — key hierarchy, in-browser derivation
- [Biometric unlock compatibility](docs/agents/biometric-compat.md) — passkey provider support matrix, troubleshooting `PrfNotEnabledError`
- [Testing conventions](docs/agents/testing.md) — unit vs integration, coverage gate, single-file runs
- [DB migrations](docs/agents/db-migrations.md) — schema location, migration workflow
- [Importers](docs/agents/imports.md) — parser interface, content-sniff registry, shared helpers, how to add a parser

## Releasing

Versions are bumped in **lockstep**: root `package.json` plus every workspace `package.json` move to the same number on every release. Internal packages aren't published, so per-package semver buys nothing — one version is the product version.

Ritual:

1. Land all release content on `main` via PR; `make ci` green.
2. One `chore(release): X.Y.Z` PR that bumps all 7 `package.json` files and moves `[Unreleased]` into a dated `## [X.Y.Z]` section in `CHANGELOG.md`.
3. Merge, then tag the merge commit `vX.Y.Z` and push the tag — this triggers `docker-push.yml` to publish `allisson/blindpass-server:X.Y.Z` and `allisson/blindpass-webapp:X.Y.Z` to Docker Hub.
4. Create the GitHub release from the tag; body = the new `CHANGELOG.md` section, hand-written (do not use auto-generated notes).
5. Verify Docker Hub has the new tags before announcing.

Pre-flight: `grep '"version"'` across the 7 `package.json` files must show one consistent number.
