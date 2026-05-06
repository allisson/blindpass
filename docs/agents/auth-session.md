# Auth and Session Model

- Authentication: permanent username + 6-digit TOTP authenticator (no passwords sent to server).
- Session token stored as `SHA-256(token)` in PostgreSQL. Cookie name `bp_session`, `HttpOnly; SameSite=Strict`.
- CSRF protection for cookie-based mutations: `x-bp-client: web` header required + Origin/Referer must match `CORS_ORIGIN`.
- Bearer token auth also supported (no CSRF check).
- `REDIS_URL` moves session storage to Redis in production.
