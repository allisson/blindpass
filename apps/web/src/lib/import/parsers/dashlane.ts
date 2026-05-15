import { VaultItemSchema } from '@blindpass/vault';
import type { VaultItem } from '@blindpass/vault';
import { coerceToSecureNote } from '../coerce';
import { harvestCustomFields } from '../customFields';
import { parseCsvRows } from '../csv';
import { parseTotpUri } from '../totp';
import type { ImportResult } from '../types';
import { readZip } from '../zip';

function rowToRecord(headers: string[], cols: string[]): Record<string, string> {
  const rec: Record<string, string> = {};
  for (let i = 0; i < headers.length; i++) {
    rec[headers[i]] = cols[i] ?? '';
  }
  return rec;
}

function parseCsv(raw: string): { headers: string[]; records: Record<string, string>[] } {
  const rows = parseCsvRows(raw);
  if (rows.length < 2) return { headers: [], records: [] };
  const headers = rows[0].map((h) => h.toLowerCase().trim());
  const records = rows.slice(1).map((cols) => rowToRecord(headers, cols));
  return { headers, records };
}

function parseCredentials(raw: string): { items: VaultItem[]; skipped: number } {
  const { records } = parseCsv(raw);
  const items: VaultItem[] = [];
  let skipped = 0;
  const handled = new Set([
    'username',
    'username2',
    'username3',
    'title',
    'password',
    'note',
    'url',
    'category',
    'otpsecret',
    'otpurl',
  ]);

  for (const r of records) {
    const password = r.password;
    if (!password) {
      skipped++;
      continue;
    }
    const title = r.title || r.url || '';
    const username = r.username || r.username2 || r.username3 || '';
    const extras = harvestCustomFields(r, handled);

    const loginResult = VaultItemSchema.safeParse({
      type: 'login',
      title,
      username,
      password,
      url: r.url || undefined,
      notes: r.note || undefined,
      customFields: extras.length ? extras : undefined,
    });
    if (loginResult.success) {
      items.push(loginResult.data);
    } else {
      skipped++;
      continue;
    }

    const totpInput = r.otpurl || r.otpsecret;
    if (totpInput) {
      const totp = parseTotpUri(totpInput);
      if (totp) {
        const totpResult = VaultItemSchema.safeParse({
          type: 'totp',
          title: title || totp.issuer || totp.accountName || 'TOTP',
          secret: totp.secret,
          issuer: totp.issuer,
          accountName: totp.accountName,
          algorithm: totp.algorithm,
          digits: totp.digits,
          period: totp.period,
        });
        if (totpResult.success) items.push(totpResult.data);
      }
    }
  }
  return { items, skipped };
}

function parsePayments(raw: string): { items: VaultItem[]; skipped: number } {
  const { records } = parseCsv(raw);
  const items: VaultItem[] = [];
  let skipped = 0;
  const handled = new Set([
    'type',
    'account_name',
    'account_holder',
    'cc_number',
    'code',
    'expiration_month',
    'expiration_year',
    'note',
    'name',
  ]);
  for (const r of records) {
    if (!r.cc_number) {
      skipped++;
      continue;
    }
    const extras = harvestCustomFields(r, handled);
    const result = VaultItemSchema.safeParse({
      type: 'payment_card',
      title: r.account_name || r.name || 'Payment card',
      cardholderName: r.account_holder || '',
      number: r.cc_number,
      expMonth: r.expiration_month || '',
      expYear: r.expiration_year || '',
      cvv: r.code || undefined,
      notes: r.note || undefined,
      customFields: extras.length ? extras : undefined,
    });
    if (result.success) items.push(result.data);
    else skipped++;
  }
  return { items, skipped };
}

function parseIds(raw: string): { items: VaultItem[]; skipped: number } {
  const { records } = parseCsv(raw);
  const items: VaultItem[] = [];
  let skipped = 0;
  for (const r of records) {
    const idType = r.type || 'ID';
    const category = idType.toLowerCase().includes('passport')
      ? 'Passport'
      : idType.toLowerCase().includes('license') || idType.toLowerCase().includes('driver')
        ? "Driver's License"
        : idType.toLowerCase().includes('ssn') || idType.toLowerCase().includes('social')
          ? 'SSN'
          : idType;
    const title = r.name || r.number || '(untitled)';
    const harvested = harvestCustomFields(r, new Set(['name', 'note']));
    const coerced = coerceToSecureNote({
      categoryName: category,
      title,
      customFields: harvested,
      sourceNotes: r.note || undefined,
    });
    if (coerced) items.push(coerced);
    else skipped++;
  }
  return { items, skipped };
}

function parsePersonalInfo(raw: string): { items: VaultItem[]; skipped: number } {
  const { records } = parseCsv(raw);
  const items: VaultItem[] = [];
  let skipped = 0;
  const handled = new Set([
    'first_name',
    'last_name',
    'middle_name',
    'email',
    'phone_number',
    'address',
    'city',
    'country',
    'title',
    'note',
  ]);
  for (const r of records) {
    const firstName = r.first_name || '';
    const lastName = r.last_name || '';
    if (!firstName || !lastName) {
      const harvested = harvestCustomFields(r, new Set(['title', 'note']));
      const coerced = coerceToSecureNote({
        categoryName: 'Personal Info',
        title: r.title || `${firstName} ${lastName}`.trim() || '(untitled)',
        customFields: harvested,
        sourceNotes: r.note || undefined,
      });
      if (coerced) items.push(coerced);
      else skipped++;
      continue;
    }
    const harvested = harvestCustomFields(r, handled);
    const result = VaultItemSchema.safeParse({
      type: 'identity',
      title: r.title || `${firstName} ${lastName}`,
      firstName,
      lastName,
      email: r.email || undefined,
      phone: r.phone_number || undefined,
      address: r.address || undefined,
      city: r.city || undefined,
      country: r.country || undefined,
      notes: r.note || undefined,
      customFields: harvested.length ? harvested : undefined,
    });
    if (result.success) items.push(result.data);
    else skipped++;
  }
  return { items, skipped };
}

function parseSecureNotes(raw: string): { items: VaultItem[]; skipped: number } {
  const { records } = parseCsv(raw);
  const items: VaultItem[] = [];
  let skipped = 0;
  const handled = new Set(['title', 'note']);
  for (const r of records) {
    const extras = harvestCustomFields(r, handled);
    const result = VaultItemSchema.safeParse({
      type: 'secure_note',
      title: r.title || '(untitled)',
      content: r.note || '',
      customFields: extras.length ? extras : undefined,
    });
    if (result.success) items.push(result.data);
    else skipped++;
  }
  return { items, skipped };
}

interface DashlaneSubParser {
  keyword: string;
  parse: (raw: string) => { items: VaultItem[]; skipped: number };
}

const SUB_PARSERS: DashlaneSubParser[] = [
  { keyword: 'credentials', parse: parseCredentials },
  { keyword: 'payments', parse: parsePayments },
  { keyword: 'ids', parse: parseIds },
  { keyword: 'personalinfo', parse: parsePersonalInfo },
  { keyword: 'securenotes', parse: parseSecureNotes },
];

function decode(bytes: Uint8Array): string {
  return new TextDecoder('utf-8').decode(bytes);
}

export async function parse(bytes: Uint8Array): Promise<ImportResult> {
  const entries = await readZip(bytes);
  const items: VaultItem[] = [];
  let skipped = 0;

  for (const [name, content] of entries) {
    if (!name.toLowerCase().endsWith('.csv')) continue;
    const lower = name.toLowerCase();
    const sub = SUB_PARSERS.find((s) => lower.includes(s.keyword));
    if (!sub) continue;
    const result = sub.parse(decode(content));
    items.push(...result.items);
    skipped += result.skipped;
  }

  return { items, skipped, attachmentsDropped: 0 };
}

// Exposed for tests — parse a single CSV without the zip wrapper.
export const __internal = {
  parseCredentials,
  parsePayments,
  parseIds,
  parsePersonalInfo,
  parseSecureNotes,
};
