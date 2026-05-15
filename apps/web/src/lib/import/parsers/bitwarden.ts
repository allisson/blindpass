import { VaultItemSchema } from '@blindpass/vault';
import type { VaultItem } from '@blindpass/vault';
import { coerceToSecureNote } from '../coerce';
import type { ImportResult } from '../types';
import { parseTotpUri } from '../totp';

const BITWARDEN_TYPE_NAMES: Record<number, string> = {
  1: 'Login',
  2: 'Secure Note',
  3: 'Card',
  4: 'Identity',
  5: 'SSH Key',
};

function bitwardenCategory(bwType: unknown): string {
  if (typeof bwType === 'number' && BITWARDEN_TYPE_NAMES[bwType]) {
    return `Bitwarden ${BITWARDEN_TYPE_NAMES[bwType]}`;
  }
  if (bwType === undefined || bwType === null) return 'Bitwarden item';
  return `Bitwarden type ${bwType}`;
}

function mapSshKey(item: Record<string, unknown>): VaultItem | null {
  const sshKey = (item.sshKey ?? {}) as Record<string, unknown>;
  const privateKey = typeof sshKey.privateKey === 'string' ? sshKey.privateKey : '';
  const publicKey = typeof sshKey.publicKey === 'string' ? sshKey.publicKey : '';
  const fingerprint = typeof sshKey.keyFingerprint === 'string' ? sshKey.keyFingerprint : '';
  if (!privateKey || !publicKey || !fingerprint) return null;
  const result = VaultItemSchema.safeParse({
    type: 'developer_credential',
    credentialMode: 'ssh_key',
    title: item.name ?? '',
    privateKey,
    publicKey,
    fingerprint,
    username: 'imported',
    host: 'imported',
    notes: item.notes || undefined,
    customFields: parseCustomFields(item.fields),
  });
  return result.success ? result.data : null;
}

function coerceFromRawItem(item: Record<string, unknown>, bwType: unknown): VaultItem | null {
  const title = typeof item.name === 'string' ? item.name : '';
  const fields = parseCustomFields(item.fields) ?? [];
  return coerceToSecureNote({
    categoryName: bitwardenCategory(bwType),
    title,
    customFields: fields,
    sourceNotes: typeof item.notes === 'string' ? item.notes : undefined,
  });
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
      } else if (bwType === 5) {
        const sshResult = mapSshKey(item);
        if (sshResult) {
          items.push(sshResult);
        } else {
          const coerced = coerceFromRawItem(item, bwType);
          if (coerced) items.push(coerced);
          else skipped++;
        }
      } else {
        const coerced = coerceFromRawItem(item, bwType);
        if (coerced) items.push(coerced);
        else skipped++;
      }
    } catch {
      try {
        const coerced = coerceFromRawItem(
          rawItem as Record<string, unknown>,
          (rawItem as Record<string, unknown>)?.type,
        );
        if (coerced) items.push(coerced);
        else skipped++;
      } catch {
        skipped++;
      }
    }
  }

  return { items, skipped, attachmentsDropped: 0 };
}
