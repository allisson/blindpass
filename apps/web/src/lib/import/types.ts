import type { VaultItem } from '@blindpass/vault';

export type ImportFormat =
  | 'chrome'
  | 'lastpass'
  | 'bitwarden'
  | 'blindpass'
  | '1password'
  | 'dashlane'
  | 'apple-keychain'
  | 'keepassxc'
  | 'protonpass';

export interface ImportResult {
  items: VaultItem[];
  skipped: number;
  attachmentsDropped: number;
}

export interface TextParserModule {
  format: ImportFormat;
  kind: 'text';
  // When 'json', the registry parses the file's JSON once per detection and
  // passes the result via the signature's second arg, avoiding an O(n) reparse
  // for each JSON parser.
  contentShape?: 'json';
  signature: (sample: string, parsedJson?: unknown) => boolean;
  parse: (raw: string) => ImportResult | Promise<ImportResult>;
  acceptExtensions: readonly string[];
}

export interface BinaryParserModule {
  format: ImportFormat;
  kind: 'binary';
  signature: (bytes: Uint8Array, filename: string) => boolean;
  parse: (bytes: Uint8Array) => Promise<ImportResult>;
  acceptExtensions: readonly string[];
}

export type ParserModule = TextParserModule | BinaryParserModule;
