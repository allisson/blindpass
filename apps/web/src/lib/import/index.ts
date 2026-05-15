import { importVaultPlaintext } from '@blindpass/vault';

import type {
  BinaryParserModule,
  ImportFormat,
  ImportResult,
  ParserModule,
  TextParserModule,
} from './types';
import { parse as parseChrome } from './parsers/chrome';
import { parse as parseLastPass } from './parsers/lastpass';
import { parse as parseBitwarden } from './parsers/bitwarden';
import { parse as parseAppleKeychain } from './parsers/apple-keychain';
import { parse as parseKeePassXC } from './parsers/keepassxc';
import { parse as parseProtonPass } from './parsers/protonpass';
import { parse as parseDashlane } from './parsers/dashlane';
import { parse as parseOnePassword } from './parsers/1password';

export type { ImportFormat, ImportResult, ParserModule, TextParserModule, BinaryParserModule };
export { parseChrome, parseLastPass, parseBitwarden };

const ZIP_MAGIC = [0x50, 0x4b, 0x03, 0x04];

function startsWithZipMagic(bytes: Uint8Array): boolean {
  if (bytes.length < 4) return false;
  return ZIP_MAGIC.every((b, i) => bytes[i] === b);
}

function bytesContain(bytes: Uint8Array, needle: string): boolean {
  const lower = needle.toLowerCase();
  // Lossy ASCII view of the first 4KB — sufficient for filename matches in
  // zip local file headers, which are stored as plain bytes.
  let s = '';
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    s += b >= 0x20 && b < 0x7f ? String.fromCharCode(b) : ' ';
  }
  return s.toLowerCase().includes(lower);
}

function endsWithIgnoreCase(value: string, suffix: string): boolean {
  return value.toLowerCase().endsWith(suffix.toLowerCase());
}

function looksTextual(bytes: Uint8Array): boolean {
  let controlCount = 0;
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    if (b === 0) return false;
    if ((b >= 0x00 && b <= 0x08) || b === 0x0b || (b >= 0x0e && b <= 0x1f)) {
      controlCount++;
    }
  }
  return controlCount / Math.max(1, bytes.length) < 0.05;
}

// --- Parser modules ------------------------------------------------------

const chromeParser: TextParserModule = {
  format: 'chrome',
  kind: 'text',
  acceptExtensions: ['.csv'],
  signature: (s) => /^name\s*,\s*url\s*,\s*username\s*,\s*password/im.test(s.slice(0, 256)),
  parse: parseChrome,
};

const lastpassParser: TextParserModule = {
  format: 'lastpass',
  kind: 'text',
  acceptExtensions: ['.csv'],
  signature: (s) => /^url\s*,\s*username\s*,\s*password\s*,\s*totp/im.test(s.slice(0, 256)),
  parse: parseLastPass,
};

const bitwardenParser: TextParserModule = {
  format: 'bitwarden',
  kind: 'text',
  contentShape: 'json',
  acceptExtensions: ['.json'],
  signature: (_s, parsed) => {
    return (
      !!parsed &&
      typeof parsed === 'object' &&
      Array.isArray((parsed as Record<string, unknown>).items) &&
      // BlindPass exports also have an items[] — distinguish by absence of "type".
      (parsed as Record<string, unknown>).type === undefined
    );
  },
  parse: parseBitwarden,
};

const blindpassParser: TextParserModule = {
  format: 'blindpass',
  kind: 'text',
  contentShape: 'json',
  acceptExtensions: ['.json', '.blindpass'],
  signature: (_s, parsed) => {
    const t = (parsed as Record<string, unknown> | null)?.type;
    return t === 'blindpass-export' || t === 'blindpass-export-encrypted';
  },
  parse: async (raw: string) => {
    const items = await importVaultPlaintext(raw);
    return { items, skipped: 0, attachmentsDropped: 0 };
  },
};

const appleKeychainParser: TextParserModule = {
  format: 'apple-keychain',
  kind: 'text',
  acceptExtensions: ['.csv'],
  signature: (s) => /^title\s*,/im.test(s.slice(0, 256)) && /otpauth/i.test(s.slice(0, 1024)),
  parse: parseAppleKeychain,
};

const keepassxcParser: TextParserModule = {
  format: 'keepassxc',
  kind: 'text',
  acceptExtensions: ['.csv'],
  signature: (s) => /^"group"\s*,\s*"title"/im.test(s.slice(0, 256)),
  parse: parseKeePassXC,
};

const protonpassParser: TextParserModule = {
  format: 'protonpass',
  kind: 'text',
  contentShape: 'json',
  acceptExtensions: ['.json'],
  signature: (_s, parsed) => {
    return (
      !!parsed && typeof parsed === 'object' && 'vaults' in (parsed as Record<string, unknown>)
    );
  },
  parse: parseProtonPass,
};

const onepasswordParser: BinaryParserModule = {
  format: '1password',
  kind: 'binary',
  acceptExtensions: ['.1pux'],
  signature: (bytes, filename) =>
    startsWithZipMagic(bytes) && endsWithIgnoreCase(filename, '.1pux'),
  parse: parseOnePassword,
};

const dashlaneParser: BinaryParserModule = {
  format: 'dashlane',
  kind: 'binary',
  acceptExtensions: ['.zip'],
  signature: (bytes, filename) => {
    if (!startsWithZipMagic(bytes)) return false;
    if (!endsWithIgnoreCase(filename, '.zip')) return false;
    return (
      bytesContain(bytes, 'credentials') ||
      bytesContain(bytes, 'payments') ||
      bytesContain(bytes, 'personalinfo') ||
      bytesContain(bytes, 'securenotes')
    );
  },
  parse: parseDashlane,
};

const PARSERS: ParserModule[] = [
  // Order matters: more specific signatures first.
  onepasswordParser,
  dashlaneParser,
  blindpassParser,
  bitwardenParser,
  protonpassParser,
  keepassxcParser,
  appleKeychainParser,
  lastpassParser,
  chromeParser,
];

function extensionFallback(filename: string): ImportFormat | null {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.blindpass')) return 'blindpass';
  if (lower.endsWith('.1pux')) return '1password';
  if (lower.endsWith('.zip')) return 'dashlane';
  if (lower.includes('lastpass')) return 'lastpass';
  if (lower.endsWith('.json')) return 'bitwarden';
  if (lower.endsWith('.csv')) return 'chrome';
  return null;
}

export async function detectFormat(file: File): Promise<ImportFormat | null> {
  const headBytes = new Uint8Array(await file.slice(0, 4096).arrayBuffer());

  for (const p of PARSERS) {
    if (p.kind !== 'binary') continue;
    if (p.signature(headBytes, file.name)) return p.format;
  }

  if (looksTextual(headBytes)) {
    const text = await file.text();
    let parsedJson: unknown = null;
    let jsonOk = false;
    try {
      parsedJson = JSON.parse(text);
      jsonOk = true;
    } catch {
      // not JSON
    }
    for (const p of PARSERS) {
      if (p.kind !== 'text') continue;
      if (p.contentShape === 'json') {
        if (!jsonOk) continue;
        if (p.signature(text, parsedJson)) return p.format;
      } else if (p.signature(text)) {
        return p.format;
      }
    }
  }

  return extensionFallback(file.name);
}

export async function parseFile(format: ImportFormat, file: File): Promise<ImportResult> {
  const parser = PARSERS.find((p) => p.format === format);
  if (!parser) throw new Error(`Unknown import format: ${format}`);
  if (parser.kind === 'binary') {
    const bytes = new Uint8Array(await file.arrayBuffer());
    return parser.parse(bytes);
  }
  const text = await file.text();
  return parser.parse(text);
}
