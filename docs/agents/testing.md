# Testing Conventions

- Unit tests: `*.unit.test.ts` — live in `__tests__/` next to source, no real DB needed (config provides stub URL).
- Integration tests: `*.integration.test.ts` — require Docker PostgreSQL, run sequentially (`fileParallelism: false`), use `src/test/global-setup.integration.ts` for DB setup.
- Coverage gate (95% lines/functions/branches) enforced only on `test:ci`.

## Running a single test file

```bash
# unit
pnpm --filter @blindpass/server vitest run --config vitest.config.unit.ts src/routes/auth/__tests__/register.unit.test.ts

# integration (requires Docker)
pnpm --filter @blindpass/server vitest run --config vitest.config.integration.ts src/routes/auth/__tests__/username-auth.integration.test.ts
```
