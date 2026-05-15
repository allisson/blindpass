import { VaultItemSchema } from '@blindpass/vault';
import type { CustomField, VaultItem } from '@blindpass/vault';
import { coerceToSecureNote } from '../coerce';
import { harvestCustomFields } from '../customFields';
import { parseTotpUri } from '../totp';
import type { ImportResult } from '../types';

interface ProtonItem {
  data?: {
    type?: string;
    metadata?: { name?: string; note?: string };
    content?: Record<string, unknown>;
    extraFields?: { fieldName?: string; data?: { content?: string } }[];
  };
}

function asString(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function asArray<T = unknown>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

function extraFieldsToCustomFields(extraFields: unknown): CustomField[] {
  return asArray<{ fieldName?: string; data?: { content?: string } }>(extraFields)
    .map((f) => ({
      label: asString(f.fieldName),
      value: asString(f.data?.content),
    }))
    .filter((f) => f.label && f.value);
}

function splitExpiration(expirationDate: string): { expMonth: string; expYear: string } | null {
  const m = expirationDate.match(/^(\d{4})-(\d{1,2})$/);
  if (m) return { expMonth: m[2], expYear: m[1] };
  const m2 = expirationDate.match(/^(\d{1,2})\s*\/\s*(\d{2,4})$/);
  if (m2) return { expMonth: m2[1], expYear: m2[2] };
  return null;
}

export function parse(raw: string): ImportResult {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error('Invalid JSON — could not parse Proton Pass export.');
  }

  if (!data || typeof data !== 'object') {
    throw new Error('Invalid Proton Pass export format.');
  }

  const root = data as Record<string, unknown>;
  const vaults = root.vaults;
  if (!vaults || typeof vaults !== 'object') {
    throw new Error('Invalid Proton Pass export — missing "vaults".');
  }

  const items: VaultItem[] = [];
  let skipped = 0;

  for (const vault of Object.values(vaults as Record<string, unknown>)) {
    if (!vault || typeof vault !== 'object') continue;
    const vaultItems = (vault as Record<string, unknown>).items;
    for (const rawItem of asArray<ProtonItem>(vaultItems)) {
      const d = rawItem.data;
      if (!d) {
        skipped++;
        continue;
      }
      const itemType = d.type;
      const title = asString(d.metadata?.name);
      const sourceNotes = asString(d.metadata?.note) || undefined;
      const content = (d.content ?? {}) as Record<string, unknown>;
      const extraFields = extraFieldsToCustomFields(d.extraFields);

      if (itemType === 'login') {
        const totpUri = asString(content.totpUri);
        const urls = asArray<string>(content.urls);
        const loginResult = VaultItemSchema.safeParse({
          type: 'login',
          title,
          username: asString(content.itemUsername) || asString(content.itemEmail),
          password: asString(content.password),
          url: urls[0] || undefined,
          notes: sourceNotes,
          customFields: extraFields.length ? extraFields : undefined,
        });
        if (loginResult.success) {
          items.push(loginResult.data);
        } else {
          skipped++;
          continue;
        }

        if (totpUri) {
          const totp = parseTotpUri(totpUri);
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
      } else if (itemType === 'note') {
        const result = VaultItemSchema.safeParse({
          type: 'secure_note',
          title,
          content: sourceNotes ?? '',
          customFields: extraFields.length ? extraFields : undefined,
        });
        if (result.success) items.push(result.data);
        else skipped++;
      } else if (itemType === 'creditCard') {
        const expSplit = splitExpiration(asString(content.expirationDate));
        const result = VaultItemSchema.safeParse({
          type: 'payment_card',
          title,
          cardholderName: asString(content.cardholderName),
          number: asString(content.number),
          expMonth: expSplit?.expMonth ?? '',
          expYear: expSplit?.expYear ?? '',
          cvv: asString(content.verificationNumber) || undefined,
          notes: sourceNotes,
          customFields: extraFields.length ? extraFields : undefined,
        });
        if (result.success) {
          items.push(result.data);
        } else {
          skipped++;
        }
      } else if (itemType === 'identity') {
        let firstName = asString(content.firstName);
        let lastName = asString(content.lastName);
        const fullName = asString(content.fullName);
        const consumedKeys = new Set([
          'firstName',
          'lastName',
          'middleName',
          'fullName',
          'email',
          'phoneNumber',
          'streetAddress',
          'city',
          'countryOrRegion',
        ]);

        if ((!firstName || !lastName) && fullName) {
          const parts = fullName.trim().split(/\s+/);
          if (parts.length >= 2) {
            firstName = firstName || parts[0];
            lastName = lastName || parts.slice(1).join(' ');
          }
        }

        if (!firstName || !lastName) {
          const harvested = harvestCustomFields(content, new Set(['fullName']));
          const coerced = coerceToSecureNote({
            categoryName: 'Identity',
            title: title || fullName || '(untitled)',
            customFields: [...extraFields, ...harvested],
            sourceNotes,
          });
          if (coerced) items.push(coerced);
          else skipped++;
          continue;
        }

        const harvested = harvestCustomFields(content, consumedKeys);
        const result = VaultItemSchema.safeParse({
          type: 'identity',
          title,
          firstName,
          lastName,
          email: asString(content.email) || undefined,
          phone: asString(content.phoneNumber) || undefined,
          address: asString(content.streetAddress) || undefined,
          city: asString(content.city) || undefined,
          country: asString(content.countryOrRegion) || undefined,
          notes: sourceNotes,
          customFields: [...extraFields, ...harvested].length
            ? [...extraFields, ...harvested]
            : undefined,
        });
        if (result.success) items.push(result.data);
        else skipped++;
      } else if (itemType === 'alias') {
        skipped++;
      } else {
        const harvested = harvestCustomFields(content, new Set());
        const coerced = coerceToSecureNote({
          categoryName: itemType ? `Proton ${itemType}` : 'Proton',
          title: title || '(untitled)',
          customFields: [...extraFields, ...harvested],
          sourceNotes,
        });
        if (coerced) items.push(coerced);
        else skipped++;
      }
    }
  }

  return { items, skipped, attachmentsDropped: 0 };
}
