# BlindPass will not ship a browser extension

**Status:** Accepted — 2026-05-09

A Chrome MV3 popup over the existing API was scaffolded under `apps/extension/` and listed in `README.md` and `PRODUCT.md` as a future client. The scaffold never shipped. Before investing in completing it, we evaluated whether the form factor is compatible with BlindPass's posture (self-hostable, small audit surface, no server-side master-password verifier, keys in memory only).

It is not. The browser-extension form factor adds three security surfaces the web app does not have, and none of them can be neutralised by careful engineering — they are inherent to the form factor:

1. **Supply-chain via web store distribution.** Chrome Web Store and Edge Add-ons can force-update the published bundle to every installed user. A compromised publisher account is a silent push channel into every user's browser. The web app, by contrast, is self-hostable and the user controls the origin they load.
2. **Host-permission scope creep.** A useful extension (autofill, capture) needs `<all_urls>` or broad host permissions. One bug then becomes a credential-exfiltration channel across every site the user visits — a far larger blast radius than a single-origin web app.
3. **MV3 cookie isolation forces weaker session handling.** The popup cannot read the web origin's `HttpOnly` `bp_session` cookie. Every workaround (token in `chrome.storage`, native messaging, declarative cookie access) weakens the zero-knowledge invariants documented in [`CONTEXT.md`](../../CONTEXT.md) and [`docs/agents/auth-session.md`](../agents/auth-session.md).

We will not ship a browser extension. `apps/extension/` is removed. References in `README.md` and `PRODUCT.md` are removed.

This is a permanent decision, not a deferral. If the form factor changes structurally — for example MV4 mandates origin-cookie access, or web stores adopt verifiable build provenance — that is a strong enough event to justify a fresh ADR superseding this one.

## Consequences

- No in-page autofill or credential capture. Users copy/paste from the web app.
- The product looks less feature-complete next to 1Password, Bitwarden, and Dashlane in surface comparison. We accept that trade — the comparison table in `README.md` already frames BlindPass as a narrower trade.
- Future contributors who propose an extension are pointed here; reopening the question requires a new ADR superseding this one, not a roadmap edit.

## Considered alternatives

- **Hardened extension with minimal permissions and storage-only token.** Rejected: minimises but does not eliminate (1) and (2); a no-permission popup is also no more useful than the web app.
- **Native messaging bridge to a local helper.** Rejected: trades extension surface for a desktop-app surface, contradicting the four-container deployment model and the "audit in an afternoon" principle.
- **Defer the decision; keep the scaffold.** Rejected: aspirational features in `README.md` and `PRODUCT.md` quietly reopen the question. The scaffold has zero call sites; keeping it is pure carrying cost.
