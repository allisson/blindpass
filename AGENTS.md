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
  extension/   Chrome extension Manifest V3 (React popup, Vite build)
packages/
  api-schema/  Zod schemas shared between server and clients
  crypto/      libsodium-wrappers-sumo primitives + Argon2id key derivation
  types/       shared TypeScript types
  vault/       domain logic — vault/item operations, keychain management
```

## Detail docs

- [Server architecture](docs/agents/server-architecture.md) — entry point, plugins, routes, validation, error handler, env
- [Auth & session model](docs/agents/auth-session.md) — TOTP, session cookie, CSRF, Bearer token
- [Zero-knowledge crypto model](docs/agents/crypto-model.md) — key hierarchy, in-browser derivation
- [Testing conventions](docs/agents/testing.md) — unit vs integration, coverage gate, single-file runs
- [DB migrations](docs/agents/db-migrations.md) — schema location, migration workflow

## Design Context

UI/UX work is governed by [PRODUCT.md](PRODUCT.md) (register, users, voice, anti-references, principles) and, when present, `DESIGN.md` (visual tokens). Register is **product**; personality is _quiet, exact, sovereign_. Run `/impeccable` commands for design tasks — they load this context automatically.
