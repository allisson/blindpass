# Vault deletion uses name-typed confirmation, not TOTP

Deleting a vault permanently purges all its items with no recovery path. Despite that severity, the confirmation gate is a name-typed dialog ("type the vault name to confirm"), not a TOTP re-entry as account deletion requires.

The asymmetry is deliberate. Account deletion erases the entire account — keys, vaults, items, auth state — and is truly irreversible. Vault deletion is scoped to one container; the last-vault guard (delete blocked when only one vault remains) removes the scenario where vault deletion approximates account destruction. The session is already authenticated and the vault already unlocked, so a TOTP gate would add friction — requiring the authenticator app to be in hand — without a meaningful security benefit over the typed-name ceremony, which already forces deliberate user intent. A TOTP gate would also fail for users temporarily without their authenticator device, blocking a legitimate destructive action they own.

## Considered alternatives

- **TOTP gate (matching account deletion).** Rejected: disproportionate friction for a scoped, owner-initiated action; the last-vault guard eliminates the worst-case scenario; session auth + vault unlock already establish trust.
- **Soft-delete / grace period.** Rejected: vault deletion should be immediate and deliberate; a grace period would persist UI deliberation as server state (the same reasoning as ADR-0001 for account deletion).
