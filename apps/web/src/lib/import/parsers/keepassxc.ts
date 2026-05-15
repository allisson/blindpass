import { VaultItemSchema } from '@blindpass/vault';
import type { VaultItem } from '@blindpass/vault';
import { parseCsvRows } from '../csv';
import { parseTotpUri } from '../totp';
import type { ImportResult } from '../types';

export function parse(raw: string): ImportResult {
  const rows = parseCsvRows(raw);
  if (rows.length < 2) return { items: [], skipped: 0, attachmentsDropped: 0 };

  const headers = rows[0].map((h) => h.toLowerCase().trim());
  const titleIdx = headers.indexOf('title');
  const usernameIdx = headers.indexOf('username');
  const passwordIdx = headers.indexOf('password');
  const urlIdx = headers.indexOf('url');
  const notesIdx = headers.indexOf('notes');
  const totpIdx = headers.indexOf('totp');

  if (passwordIdx === -1) {
    return { items: [], skipped: rows.length - 1, attachmentsDropped: 0 };
  }

  const items: VaultItem[] = [];
  let skipped = 0;

  for (let i = 1; i < rows.length; i++) {
    const cols = rows[i];
    const password = cols[passwordIdx] ?? '';
    if (!password) {
      skipped++;
      continue;
    }

    const title = titleIdx !== -1 && cols[titleIdx] ? cols[titleIdx] : '';
    const username = usernameIdx !== -1 && cols[usernameIdx] ? cols[usernameIdx] : '';
    const url = urlIdx !== -1 && cols[urlIdx] ? cols[urlIdx] : undefined;
    const notes = notesIdx !== -1 && cols[notesIdx] ? cols[notesIdx] : undefined;

    const loginResult = VaultItemSchema.safeParse({
      type: 'login',
      title,
      username,
      password,
      url,
      notes,
    });
    if (loginResult.success) {
      items.push(loginResult.data);
    } else {
      skipped++;
      continue;
    }

    if (totpIdx !== -1 && cols[totpIdx]) {
      const totp = parseTotpUri(cols[totpIdx]);
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

  return { items, skipped, attachmentsDropped: 0 };
}
