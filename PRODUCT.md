# Product

## Register

product

## Users

Privacy-pragmatic technical individuals: developers, sysadmins, and security-aware people who self-host their own infrastructure. They reach for BlindPass because they refuse to entrust their secrets to a SaaS vendor and want a tool small enough to audit themselves. They are comfortable with a terminal, comfortable reading source, and impatient with hand-holding.

Their context is daily credential use across desktop browsers. They want to unlock fast, find a secret faster, and forget the tool exists between actions. They are not the audience for marketing pastels or onboarding tours.

## Product Purpose

BlindPass is a self-hostable, end-to-end encrypted password manager whose server is a cryptographically dumb blob store — it never sees plaintext, never sees an email, never sees a password hash. Accounts are username + master password + TOTP. Keys derive in-browser via Argon2id and exist only in memory.

Success is measured by:

- A user can unlock, retrieve a secret, and lock again in under five seconds without leaving the keyboard.
- The interface communicates cryptographic state honestly — locked/unlocked, synced/pending, conflict/clean — so the user trusts what they see.
- The codebase remains "auditable in an afternoon." UI complexity that obscures the security model is a regression.

## Brand Personality

Quiet, exact, sovereign.

- **Quiet.** The interface does not perform. No celebratory toasts, no decorative motion, no badges urging upgrades. It earns attention only at moments that genuinely matter (unlock, lock, sync conflict, destructive confirmation).
- **Exact.** Every label, count, and timestamp is literal. We do not soften error messages, do not round timestamps to "a moment ago", do not show fake progress bars. Cryptographic state in particular is shown as it is.
- **Sovereign.** The tool belongs to the user. It does not nag, does not collect, does not phone home, does not pretend to know better than the operator. The aesthetic embodies that posture — restrained, confident, unornamented.

Voice is direct and technical, in the register of a well-written RFC or a Linear changelog. No exclamation marks, no emoji in product copy, no "Oops!" error pages. The README's tone (_"the math protects you; a strong password makes it unbreakable"_) is the ceiling for marketing language inside the app — usually we drop a notch quieter.

## Anti-references

- **Generic shadcn / v0 defaults.** Untouched slate palette, identical card grids, hero-metric templates, the AI-generated-dashboard look. shadcn is the substrate, not the design. Every surface should make it obvious a human shaped it.
- **1Password / Dashlane SaaS-cream.** Rounded marketing pastels, friendly illustrations, onboarding confetti. BlindPass is not a consumer subscription product and should not cosplay as one.
- **Crypto / web3 neon-on-black.** Saturated gradients, glassmorphism, "trustless" signaling, animated hero blobs. Performance over substance is the opposite of what we promise.
- **Bitwarden corporate-bootstrap.** Dense charmless forms, generic blue, vault-as-spreadsheet. Functional minima are not an excuse for absent craft.

## Design Principles

1. **Show, don't tell.** Cryptographic guarantees are demonstrated by honest interface state, not by reassurance copy. If the vault is locked, the UI shows it is locked — no decorative shield icons claiming safety. If sync is pending, the timestamp says so. If a conflict exists, it is named and resolvable. Security theater is forbidden.

2. **Calm by default, expressive at the moments that matter.** The tool sits quietly during routine use. Unlock, lock, sync resolution, destructive actions, and recovery flows are the few places where motion, weight, or color may carry real meaning. Everywhere else, restraint.

3. **Trust the operator.** Users are technical and self-hosting their own server. We do not over-explain, do not gate features behind dismissable tours, do not add "Are you sure?" to non-destructive actions. Density is fine. Terseness is fine. Keyboard-first is required.

4. **The interface is the proof.** No telemetry, no dark patterns, no fake urgency, no analytics-driven UI. Anything that would feel out of place in a tool the user audited last weekend should not ship.

5. **Small enough to read.** UI complexity competes with the auditability promise. When two designs solve the problem, prefer the one with less code, fewer abstractions, and fewer dependencies.

## Accessibility & Inclusion

WCAG 2.2 AA across both themes. No additional commitments stated; specific accommodations (reduced motion, focus order, contrast on critical state changes) are addressed case by case as features ship.
