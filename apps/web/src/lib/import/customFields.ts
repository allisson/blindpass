import type { CustomField } from '@blindpass/vault';

// Patterns run against a normalized key (lowercased, all non-alphanumeric
// collapsed to `_`) so "Recovery Phrase", "recoveryPhrase", and
// "recovery-phrase" all match. Short tokens (pin/cvv/cvc) use underscore
// boundaries to avoid false positives like "pinterest".
const SECRET_SUBSTRINGS = /password|secret|mnemonic|recovery_?phrase|private_?key|^totp/;
const SECRET_TOKENS = /(^|_)(pin|cvv|cvc)(_|$)/;

export function isSecretKey(key: string): boolean {
  const k = key.toLowerCase().replace(/[^a-z0-9]+/g, '_');
  return SECRET_SUBSTRINGS.test(k) || SECRET_TOKENS.test(k);
}

export function harvestCustomFields(
  source: Record<string, unknown>,
  consumed: Set<string>,
): CustomField[] {
  const fields: CustomField[] = [];
  for (const [key, value] of Object.entries(source)) {
    if (consumed.has(key)) continue;
    if (isSecretKey(key)) continue;
    if (value == null) continue;
    if (typeof value === 'object') continue;
    if (typeof value === 'boolean') {
      fields.push({ label: humanizeLabel(key), value: value ? 'true' : 'false' });
      continue;
    }
    const str = String(value).trim();
    if (!str) continue;
    fields.push({ label: humanizeLabel(key), value: str });
  }
  return fields;
}

function humanizeLabel(key: string): string {
  return key
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .trim()
    .replace(/\b(\w)/g, (c) => c.toUpperCase());
}
