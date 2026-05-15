# Importers coerce unsupported source categories to secure notes

When a source password manager has an item category that doesn't map to one of BlindPass's seven item types (login, secure_note, payment_card, identity, totp, developer_credential, crypto_wallet), the importer coerces it into a `secure_note` with a `[Source Category Name] ` title prefix. Source-specific fields land in `customFields`. The user retains the data and can recategorise later; no information is silently dropped.

The trade-off is that the imported item is structurally a note rather than something domain-shaped — for instance, a 1Password "Bank Account" becomes `[Bank Account] Chase Checking` (a `secure_note`) rather than a first-class item. This is honest about what BlindPass models, lossless within the data model, and a single fallback function instead of fifteen bespoke per-category mappers.

## Considered alternatives

**Drop unknown categories** (the previous Bitwarden behaviour) was rejected because a typical 1Password vault contains ~half of its items in the long-tail categories — Bank Account, Database, Driver's License, Membership, Passport, Server, Software License, Wireless Router, and similar. Dropping them silently would lose meaningful migration data with no user-visible signal.

**Per-category curation** — mapping passport/driver-license/SSN to `identity`, bank-account/server/database to `secure_note`, membership/rewards-program to `secure_note`, etc., one branch per known source category — was rejected because (1) the schema-required fields on `identity` (`firstName`/`lastName`) don't exist on most government-ID categories, so coercing them silently produces malformed items that fail `safeParse` and end up skipped anyway; (2) it grows the importer code by an order of magnitude with little value over the single coerce path; (3) each source format would need its own per-category mapping table, multiplying maintenance cost.
