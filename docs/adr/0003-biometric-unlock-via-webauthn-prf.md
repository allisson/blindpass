# Biometric unlock uses WebAuthn PRF to wrap MasterKey on-device

**Status:** Accepted — 2026-05-09

## Context

Every return to the tab after a `session.lock()` (idle expiry, manual lock, refresh) costs the user a full master-password entry plus an Argon2id derivation. On mobile especially this is the dominant friction in daily use. We want a faster vault-unlock path without weakening the zero-knowledge invariants documented in [CONTEXT.md](../../CONTEXT.md):

- Master password never leaves the device.
- The server stores no password verifier and no decryptable key material.
- Recovery via the BIP39 mnemonic remains the documented escape hatch.

## Decision

Add an opt-in per-device **Biometric unlock** flow using WebAuthn with the `prf` extension. The PRF output is a deterministic 32-byte secret per `(credential, salt)` gated by the platform authenticator (Touch ID / Face ID / Windows Hello / Android biometric); we use it as the **BUK** (Biometric Unlock Key) to wrap **MasterKey** at rest in IndexedDB on the device. The server is uninvolved.

Concretely:

- A new IndexedDB database `bp:biometric-unlock` stores one `BiometricEnrollment` record per `(device, username)` pair: `{credentialId, prfSalt, encryptedMasterKey, rpId, createdAt, label?}`. No passwords, no verifiers, no decryptable keys.
- Enrollment is settings-only opt-in, while the vault is unlocked. Per device.
- `/unlock` shows a prominent "Unlock with [Touch ID / Face ID / …]" button when an enrollment exists and the platform supports PRF. Password remains a one-click fallback.
- Enrollment **survives** `session.lock()` (idle expiry, manual lock) and password rotation. It is **cleared** on `session.clear()` (logout, session expired) or explicit disenrollment from settings.
- No periodic password re-prompt. Biometric is convenience over a credential the user already controls.

## Key trade-offs

1. **PRF output as raw key vs presence-gated CryptoKey wrap.** PRF gives a deterministic 32-byte secret reproducible only after a successful platform UV ceremony — usable directly as a wrap key. The alternative ("user-presence-gated non-extractable CryptoKey stored in IndexedDB") provides only presence proof, not key material — we'd still need a password-derived KEK to decrypt MasterKey, defeating the convenience goal. PRF is the only mechanism that lets the master password be entirely absent from the unlock path. Cost: narrower support (Chrome 116+, Safari 18+, Android Chrome recent).
2. **Wrap MasterKey, not KEK.** MasterKey is invariant across password rotation and recovery (only KEK is re-derived). Wrapping MasterKey means biometric enrollment survives both flows. Wrapping KEK would force re-enrolment on every rotation.
3. **Local-only storage.** Server stores nothing biometric — no schema change, no endpoint, no cross-device replay risk. Cost: per-device enrollment (a user with three devices enrols three times). Acceptable; matches the per-device passkey mental model.
4. **Lock vs clear distinction.** Enrollment survives `session.lock()` but is wiped on `session.clear()`. This asymmetry is what makes biometric useful — it's the lock-recovery path, not a session-recovery path. Documented inline in `CONTEXT.md` because it is non-obvious.
5. **Password remains canonical.** No periodic re-prompt. The recovery mnemonic is the documented escape hatch if the device is lost or biometric fails permanently. Biometric cannot replace the master password.

## Considered alternatives

- **Server-side biometric attestation as a session extension.** Would let the server gate session resumption on UV. Rejected — rotates blast radius into the server and conflates server session with vault unlock, contrary to the existing separation in [`docs/agents/auth-session.md`](../agents/auth-session.md).
- **Cache MasterKey in Service Worker memory across page loads.** Fragile (SW eviction policy is browser-discretionary), and a cross-origin XSS becomes a key-theft event. Rejected.
- **Wrap with a non-extractable CryptoKey gated by WebAuthn user-presence.** Broader browser support but provides only presence, not key material — see trade-off 1.
- **Periodic password re-prompt every N days.** Industry-standard hedge against password-amnesia (1Password, Bitwarden). Rejected for now; the recovery mnemonic already covers the failure mode and the re-prompt is widely perceived as nagging. Revisit if user reports indicate amnesia is a real problem.

## Consequences

- A new IndexedDB database `bp:biometric-unlock` lives alongside `bp:vault-cache` on devices where the user enables this feature. The README's "key material is never written to disk" claim is softened to acknowledge this opt-in exception.
- New code surface in `apps/web/src/lib/biometric/` (PRF probe, register, assert, BUK wrap, IndexedDB adapter) and two new hooks in `apps/web/src/hooks/`.
- `packages/vault` exposes `unlockFromMasterKey` so password, recovery, and biometric unlock paths share the post-MasterKey path.
- `session.clear()` propagates to biometric storage; `session.lock()` does not.
- A new threat model row: an attacker with physical device access who can defeat the platform authenticator can decrypt the wrapped MasterKey on disk. Users who do not want this surface can leave biometric unlock disabled (the default).
- `CONTEXT.md` gains **BUK**, **BiometricEnrollment**, and **Biometric unlock** glossary terms.
