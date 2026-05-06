import type { VaultItem } from '@blindpass/vault';

export type ImportFormat = 'chrome' | 'lastpass' | 'bitwarden' | 'blindpass';

export interface ImportResult {
  items: VaultItem[];
  skipped: number;
}
