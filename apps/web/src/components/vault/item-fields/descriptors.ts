import type { VaultItem } from '@blindpass/vault';

export type VaultItemType = VaultItem['type'];

type ItemOf<K extends VaultItemType> = Extract<VaultItem, { type: K }>;

/**
 * Per-type field-selection for one VaultItem discriminator. The single audit
 * point for "which fields matter for type X" outside of the form registry.
 *
 * Invariants (locked by descriptors.test.ts):
 * - `toSearchText` MUST NOT emit secret material (password, number, cvv,
 *   secret, clientSecret, privateKey, passphrase, mnemonic). The search
 *   haystack is a plaintext index — leaking a secret here is a disclosure bug.
 * - `toSearchText` returns raw case and excludes `title` (generic across all
 *   types); callers lowercase once and match title separately.
 * - `subtitle` is display copy (separators, truncation, fallbacks) and is
 *   likewise secret-free.
 */
export interface ItemDescriptor<K extends VaultItemType> {
  toSearchText: (item: ItemOf<K>) => string;
  subtitle: (item: ItemOf<K>) => string;
}

type DescriptorMap = { [K in VaultItemType]: ItemDescriptor<K> };

const join = (parts: (string | undefined)[], sep = ' ') => parts.filter(Boolean).join(sep);

export const ITEM_DESCRIPTORS: DescriptorMap = {
  login: {
    toSearchText: (item) => join([item.username, item.url]),
    subtitle: (item) => item.username,
  },
  secure_note: {
    toSearchText: (item) => item.content,
    subtitle: (item) => item.content.slice(0, 40) + (item.content.length > 40 ? '…' : ''),
  },
  payment_card: {
    toSearchText: (item) => item.cardholderName,
    subtitle: (item) => item.cardholderName,
  },
  identity: {
    toSearchText: (item) => join([item.firstName, item.lastName]),
    subtitle: (item) => `${item.firstName} ${item.lastName}`.trim(),
  },
  totp: {
    toSearchText: (item) => join([item.issuer, item.accountName]),
    subtitle: (item) => join([item.issuer, item.accountName], ' · ') || 'Authenticator',
  },
  developer_credential: {
    toSearchText: (item) =>
      join(
        item.credentialMode === 'token'
          ? [item.provider, item.environment, item.keyId, item.baseUrl]
          : item.credentialMode === 'client_secret_pair'
            ? [item.provider, item.environment, item.clientId, item.baseUrl]
            : [item.username, item.host, item.algorithm, item.fingerprint],
      ),
    subtitle: (item) =>
      item.credentialMode === 'ssh_key'
        ? join([item.username, item.host], ' @ ')
        : join([item.provider, item.environment], ' · '),
  },
  crypto_wallet: {
    toSearchText: (item) => join([item.walletName, item.network, item.addressHint]),
    subtitle: (item) => {
      const wordCount = item.mnemonic.trim().split(/\s+/).length;
      const primary = item.walletName ?? item.addressHint ?? `${wordCount}-word seed`;
      return item.network ? `${item.network} · ${primary}` : primary;
    },
  },
};

type LooseItem = { type: string };

/**
 * Space-joined, non-secret search haystack for an item. Excludes `title` (the
 * caller matches that separately) and returns raw case. Unknown types yield ''
 * so no legacy/future discriminator can throw here.
 */
export function getItemSearchText(item: LooseItem): string {
  const descriptor = ITEM_DESCRIPTORS[item.type as VaultItemType];
  return descriptor ? descriptor.toSearchText(item as never) : '';
}

/** Single-line display subtitle for an item. Secret-free; '' for unknown types. */
export function getItemSubtitle(item: LooseItem): string {
  const descriptor = ITEM_DESCRIPTORS[item.type as VaultItemType];
  return descriptor ? descriptor.subtitle(item as never) : '';
}
