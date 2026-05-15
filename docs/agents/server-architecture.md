# Server Architecture (`apps/server`)

**Entry point** `src/index.ts` — checks `process.argv[2]`: `migrate` runs Drizzle migrations then exits; default starts the HTTP server.

**Plugins** registered in order:

- `plugins/db.ts` — Drizzle ORM over a `pg` Pool; decorates `app.db`
- `plugins/clock.ts` — `app.clock.now()` returns the current epoch ms; default returns `Date.now()`. Owns every time-sensitive read (session expiry, TOTP windows, recovery token expiry, the auth plugin's idle check, the periodic cleanup interval). Tests register a `fixedClock`/`advanceableClock` from `src/test/fake-clock.ts` instead of spying on `Date.now`.
- `plugins/auth.ts` — validates `bp_session` cookie or Bearer token; decorates `request.userId` / `request.sessionId`. Reads `app.clock` for the idle ceiling.

**Transactional handle** — `src/db/tx.ts` exports `TxDb` (a branded `NodePgDatabase`) and `asTx(tx)` to brand the handle inside `app.db.transaction(...)`. Every write-path service signature (and the `vaults/quota.ts` advisory-lock helpers) requires `TxDb`, so a service call outside a transaction is a compile error. Read-path services and repositories continue to accept the un-branded handle.

**Routes** (`src/routes/`):

- `auth/` — registration, TOTP enrollment, login (start + complete), logout, sessions, account recovery
- `user/` — key material, TOTP rotation, password change, account deletion, username lookup
- `vaults/` — CRUD for vaults and encrypted items
- `admin/` — registration gate, user management, quota controls

**Validation** — `fastify-type-provider-zod`; all request/response shapes defined in `@blindpass/api-schema`.

**Error handler** — `src/error-handler.ts`; maps Zod validation errors, known domain errors, and unknown errors to structured JSON responses.

**Env** — parsed and validated at startup by Zod in `src/env.ts`. `NODE_ENV` is required; `REDIS_URL` is required in production; `TOTP_SECRET_ENCRYPTION_KEY` is a base64-encoded 32-byte key.
