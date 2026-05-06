export type { ImportFormat, ImportResult } from './types';
export { parse as parseChrome } from './parsers/chrome';
export { parse as parseLastPass } from './parsers/lastpass';
export { parse as parseBitwarden } from './parsers/bitwarden';

import type { ImportFormat, ImportResult } from './types';
import { parse as parseChrome } from './parsers/chrome';
import { parse as parseLastPass } from './parsers/lastpass';
import { parse as parseBitwarden } from './parsers/bitwarden';

export function detectFormat(filename: string): ImportFormat | null {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.json')) return 'bitwarden';
  if (lower.includes('lastpass')) return 'lastpass';
  if (lower.endsWith('.csv')) return 'chrome';
  if (lower.endsWith('.blindpass')) return 'blindpass';
  return null;
}

export function parseFile(format: ImportFormat, raw: string): ImportResult {
  switch (format) {
    case 'chrome':
      return parseChrome(raw);
    case 'lastpass':
      return parseLastPass(raw);
    case 'bitwarden':
      return parseBitwarden(raw);
    case 'blindpass':
      throw new Error('BlindPass files require async import');
  }
}
