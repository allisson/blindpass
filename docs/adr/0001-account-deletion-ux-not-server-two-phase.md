# Account deletion is a UX two-step, not a server two-phase

The browser shows account deletion as a two-step modal (consequence screen → TOTP entry), but the server endpoint stays single-call: `DELETE /user` with `{authenticatorCode}`. The first step is pure client-side deliberation — no server state, no intent token, no pending-deletion record. The TOTP gate (and its 3/15min rate limit) is the only security boundary; adding a server-side two-phase flow would persist UI state as domain state for no security or audit gain. If a future need surfaces an actual domain reason for a deletion intent (audit trail, grace period, async tombstoning), revisit then — don't pre-build it.

## Considered alternatives

- **Server intent-token** (`POST /user/deletion-intent` → `DELETE /user` with `{intentToken, authenticatorCode}`). Rejected: persists UI deliberation as DB state, adds expiry job and attack surface, no real security delta over a single TOTP-gated call.
- **Re-auth with password proof on top of TOTP.** Rejected: TOTP rate-limit already covers brute-force; requiring an unlocked KEK to delete adds failure modes (forgotten password, locked vault) without meaningful security gain.
