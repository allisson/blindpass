import { VaultItemSchema } from '@blindpass/vault';
import { parseCsvRows } from '../csv';
import type { ImportResult } from '../types';

function titleFromUrl(url: string): string {
  try {
    return new URL(url).hostname || url;
  } catch {
    return url;
  }
}

export function parse(raw: string): ImportResult {
  const rows = parseCsvRows(raw);
  if (rows.length < 2) return { items: [], skipped: 0, attachmentsDropped: 0 };

  const headers = rows[0].map((h) => h.toLowerCase().trim());
  const nameIdx = headers.indexOf('name');
  const urlIdx = headers.indexOf('url');
  const usernameIdx = headers.indexOf('username');
  const passwordIdx = headers.indexOf('password');
  const noteIdx = headers.indexOf('note');

  if (usernameIdx === -1 || passwordIdx === -1) {
    return { items: [], skipped: rows.length - 1, attachmentsDropped: 0 };
  }

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
      const rawTitle = nameIdx !== -1 ? (cols[nameIdx] ?? '') : '';
      const title = rawTitle || (url ? titleFromUrl(url) : '');

      const result = VaultItemSchema.safeParse({
        type: 'login',
        title,
        username: cols[usernameIdx] ?? '',
        password,
        url,
        notes: noteIdx !== -1 && cols[noteIdx] ? cols[noteIdx] : undefined,
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

  return { items, skipped, attachmentsDropped: 0 };
}
