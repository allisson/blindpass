import { VaultItemSchema } from '@blindpass/vault';
import { parseCsvRows } from '../csv';
import type { ImportResult } from '../types';

export function parse(raw: string): ImportResult {
  const rows = parseCsvRows(raw);
  if (rows.length < 2) return { items: [], skipped: 0 };

  const headers = rows[0].map((h) => h.toLowerCase().trim());
  const nameIdx = headers.indexOf('name');
  const urlIdx = headers.indexOf('url');
  const usernameIdx = headers.indexOf('username');
  const passwordIdx = headers.indexOf('password');
  const extraIdx = headers.indexOf('extra');

  if (passwordIdx === -1) return { items: [], skipped: rows.length - 1 };

  const items = [];
  let skipped = 0;

  for (let i = 1; i < rows.length; i++) {
    const cols = rows[i];
    try {
      const password = cols[passwordIdx] ?? '';
      if (!password) {
        skipped++;
        continue;
      }

      const url = urlIdx !== -1 && cols[urlIdx] ? cols[urlIdx] : undefined;

      // LastPass secure notes have url === 'http://sn'
      if (url === 'http://sn') {
        skipped++;
        continue;
      }

      const title = (nameIdx !== -1 ? (cols[nameIdx] ?? '') : '') || '';

      const result = VaultItemSchema.safeParse({
        type: 'login',
        title,
        username: cols[usernameIdx] ?? '',
        password,
        url,
        notes: extraIdx !== -1 && cols[extraIdx] ? cols[extraIdx] : undefined,
      });

      if (result.success) {
        items.push(result.data);
      } else {
        /* v8 ignore next */
        skipped++;
      }
    } catch {
      /* v8 ignore next */
      skipped++;
    }
  }

  return { items, skipped };
}
