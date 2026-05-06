# Server Architecture (`apps/server`)

**Entry point** `src/index.ts` — checks `process.argv[2]`: `migrate` runs Drizzle migrations then exits; default starts the HTTP server.

**Plugins** registered in order:

- `plugins/db.ts` — Drizzle ORM over a `pg` Pool; decorates `app.db`
- `plugins/auth.ts` — validates `bp_session` cookie or Bearer token; decorates `request.session`

**Routes** (`src/routes/`):

- `auth/` — registration, TOTP enrollment, login (start + complete), logout, sessions, account recovery
- `user/` — key material, TOTP rotation, password change, account deletion, username lookup
- `vaults/` — CRUD for vaults and encrypted items
- `admin/` — registration gate, user management, quota controls

**Validation** — `fastify-type-provider-zod`; all request/response shapes defined in `@blindpass/api-schema`.

**Error handler** — `src/error-handler.ts`; maps Zod validation errors, known domain errors, and unknown errors to structured JSON responses.

**Env** — parsed and validated at startup by Zod in `src/env.ts`. `NODE_ENV` is required; `REDIS_URL` is required in production; `TOTP_SECRET_ENCRYPTION_KEY` is a base64-encoded 32-byte key.
