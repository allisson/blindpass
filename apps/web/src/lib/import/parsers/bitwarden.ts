import { VaultItemSchema } from '@blindpass/vault';
import type { VaultItem } from '@blindpass/vault';
import type { ImportResult } from '../types';

interface TotpFields {
  secret: string;
  issuer?: string;
  accountName?: string;
  algorithm?: 'SHA1' | 'SHA256' | 'SHA512';
  digits?: number;
  period?: number;
}

function parseTotpUri(uri: string): TotpFields | null {
  const trimmed = uri.trim();
  if (!trimmed) return null;

  if (!trimmed.startsWith('otpauth://')) {
    return { secret: trimmed };
  }

  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'otpauth:') return null;
    const secret = url.searchParams.get('secret');
    if (!secret) return null;

    // pathname is /totp/ISSUER:ACCOUNT or /totp/ACCOUNT
    const label = decodeURIComponent(url.pathname.slice(1));
    const colonIdx = label.indexOf(':');
    const issuerFromPath = colonIdx !== -1 ? label.slice(0, colonIdx) : undefined;
    const accountName = colonIdx !== -1 ? label.slice(colonIdx + 1) : label;

    const issuer = url.searchParams.get('issuer') ?? issuerFromPath;
    const rawAlgo = url.searchParams.get('algorithm');
    const algorithm =
      rawAlgo === 'SHA256' || rawAlgo === 'SHA512' ? rawAlgo : rawAlgo ? 'SHA1' : undefined;
    const digits = url.searchParams.get('digits')
      ? Number(url.searchParams.get('digits'))
      : undefined;
    const period = url.searchParams.get('period')
      ? Number(url.searchParams.get('period'))
      : undefined;

    return {
      secret,
      issuer: issuer ?? undefined,
      accountName: accountName || undefined,
      algorithm,
      digits,
      period,
    };
  } catch {
    return null;
  }
}

function parseCustomFields(raw: unknown): { label: string; value: string }[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const fields = (raw as unknown[])
    .filter((f): f is Record<string, unknown> => !!f && typeof f === 'object')
    .filter((f) => [0, 1, 2].includes(f['type'] as number) && f['name'] != null)
    .map((f) => ({
      label: String(f['name']),
      value: f['value'] != null ? String(f['value']) : '',
    }));
  return fields.length ? fields : undefined;
}

export function parse(raw: string): ImportResult {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error('Invalid JSON — could not parse Bitwarden export.');
  }

  if (
    !data ||
    typeof data !== 'object' ||
    !Array.isArray((data as Record<string, unknown>).items)
  ) {
    throw new Error('Invalid Bitwarden export format.');
  }

  const { items: rawItems } = data as { items: unknown[] };
  const items: VaultItem[] = [];
  let skipped = 0;

  for (const rawItem of rawItems) {
    try {
      const item = rawItem as Record<string, unknown>;
      const bwType = item['type'] as number;

      if (bwType === 1) {
        const login = (item['login'] ?? {}) as Record<string, unknown>;
        const uris = login['uris'] as { uri?: string }[] | undefined;
        const loginResult = VaultItemSchema.safeParse({
          type: 'login',
          title: item['name'] ?? '',
          username: login['username'] ?? '',
          password: login['password'] ?? '',
          url: uris?.[0]?.uri || undefined,
          notes: item['notes'] || undefined,
          customFields: parseCustomFields(item['fields']),
        });
        if (loginResult.success) {
          items.push(loginResult.data);
        } else {
          skipped++;
        }

        const totpUri = login['totp'] as string | undefined;
        if (totpUri) {
          const totp = parseTotpUri(totpUri);
          if (totp) {
            const totpResult = VaultItemSchema.safeParse({
              type: 'totp',
              title: item['name'] ?? '',
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
      } else if (bwType === 2) {
        const result = VaultItemSchema.safeParse({
          type: 'secure_note',
          title: item['name'] ?? '',
          content: item['notes'] ?? '',
          customFields: parseCustomFields(item['fields']),
        });
        if (result.success) {
          items.push(result.data);
        } else {
          skipped++;
        }
      } else if (bwType === 3) {
        const card = (item['card'] ?? {}) as Record<string, unknown>;
        const result = VaultItemSchema.safeParse({
          type: 'payment_card',
          title: item['name'] ?? '',
          cardholderName: card['cardholderName'] ?? '',
          number: card['number'] ?? '',
          expMonth: card['expMonth'] ?? '',
          expYear: card['expYear'] ?? '',
          cvv: card['code'] || undefined,
          notes: item['notes'] || undefined,
          customFields: parseCustomFields(item['fields']),
        });
        if (result.success) {
          items.push(result.data);
        } else {
          skipped++;
        }
      } else if (bwType === 4) {
        const identity = (item['identity'] ?? {}) as Record<string, unknown>;
        const result = VaultItemSchema.safeParse({
          type: 'identity',
          title: item['name'] ?? '',
          firstName: identity['firstName'] ?? '',
          lastName: identity['lastName'] ?? '',
          email: (identity['email'] as string) || undefined,
          phone: (identity['phone'] as string) || undefined,
          address: (identity['address1'] as string) || undefined,
          city: (identity['city'] as string) || undefined,
          country: (identity['country'] as string) || undefined,
          notes: (item['notes'] as string) || undefined,
          customFields: parseCustomFields(item['fields']),
        });
        if (result.success) {
          items.push(result.data);
        } else {
          skipped++;
        }
      } else {
        skipped++;
      }
    } catch {
      skipped++;
    }
  }

  return { items, skipped };
}
