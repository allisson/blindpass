# Importers

All importer code lives in `apps/web/src/lib/import/`. Imports run entirely in the browser; the server never sees plaintext items.

## Parser interface

A parser is a `ParserModule` — either text or binary — declared in `types.ts`:

```ts
TextParserModule   { format, kind: 'text',   signature(string): boolean, parse(string): ImportResult | Promise<ImportResult>, acceptExtensions: string[] }
BinaryParserModule { format, kind: 'binary', signature(bytes, filename): boolean, parse(bytes): Promise<ImportResult>,        acceptExtensions: string[] }
```

`ImportResult = { items: VaultItem[], skipped: number, attachmentsDropped: number }`.

The registry in `index.ts` exposes two async entry points:

- `detectFormat(file: File): Promise<ImportFormat | null>` — three phases: (1) binary `signature` against the first 4KB of bytes + filename, (2) full-text `signature` if `looksTextual` passes, (3) filename-extension fallback.
- `parseFile(format, file: File): Promise<ImportResult>` — reads the file with `file.text()` or `file.arrayBuffer()` depending on parser kind and dispatches.

## Shared helpers

- `csv.ts::parseCsvRows` — state-machine CSV parser; handles multi-line quoted cells, BOM, CRLF.
- `totp.ts::parseTotpUri` — parses `otpauth://` URIs; treats bare strings as the raw secret.
- `customFields.ts::harvestCustomFields(source, consumed)` — collects every source key not in `consumed` into `customFields`. Defensively skips secret-bearing keys via the exported `isSecretKey(key)` predicate: substring match on `password`, `secret`, `mnemonic`, `recovery_phrase`, `private_key`, and leading `totp`; boundary-anchored match for short tokens `pin`/`cvv`/`cvc` (so `pinterest` etc. don't false-positive). The 1Password parser's `flatToCustomFields` applies the same predicate.
- `coerce.ts::coerceToSecureNote({ categoryName, title, customFields, sourceNotes?, extraContent? })` — the **category coercion** fallback (see [ADR 0006](../adr/0006-importer-category-coercion.md)).
- `zip.ts::readZip` — async wrapper over `fflate.unzip`; enforces 100MB total-size and 10k-entry caps per-archive.

## Universal parser rules

1. **TOTP split**: any source item carrying a TOTP secret emits the primary item _plus_ a paired `totp` item with the same title. Title falls back to `issuer || accountName || 'TOTP'` if the source title is empty.
2. **Field harvesting**: every source field not explicitly consumed by the schema mapping lands in `customFields` via `harvestCustomFields`. Each parser maintains a `consumed: Set<string>` of routed keys.
3. **Defensive shape checks**: JSON parsers validate the top-level shape before iterating; bad shape throws a user-readable message.
4. **Coercion fallback**: unknown source categories use `coerceToSecureNote` rather than being silently skipped.
5. **Attachments**: BlindPass has no attachment storage. Parsers that handle source attachments (1Password) drop the binary, increment `attachmentsDropped`, and append a `[Lost attachments: filename, …]` breadcrumb to the item's `notes` (or `content` for `secure_note`).

## Adding a new parser

1. Write `parsers/<name>.ts` exporting a `parse` function matching the kind (text or binary).
2. Register a `ParserModule` in `index.ts` (define its `signature` carefully — text signatures must produce a strong positive against a real export header, not a generic match).
3. Add unit tests in `__tests__/<name>.test.ts` covering: native mappings per item type, TOTP-on-login (if relevant), category coercion path, malformed-input safety, and a fixture that asserts no secret-bearing key leaks into `customFields`.
4. Add the format to the `ImportFormat` union in `types.ts` and the `FORMAT_LABELS` map in `ImportSection.tsx`. Add an entry to `<SelectContent>`.
5. Add one round-trip case to `apps/web/e2e/import-export.spec.ts`.
6. Update the `ImportFormat` glossary entry in `CONTEXT.md`.
