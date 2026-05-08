import type { ComponentType } from 'react';
import type { StandardSchemaV1 } from '@standard-schema/spec';
import {
  CryptoWalletItemSchema,
  DeveloperCredentialItemSchema,
  IdentitySchema,
  LoginItemSchema,
  PaymentCardSchema,
  SecureNoteSchema,
  TotpItemSchema,
  type VaultItem,
} from '@blindpass/vault';
import { CryptoWalletFields } from './CryptoWalletFields';
import { DeveloperCredentialFields } from './DeveloperCredentialFields';
import { IdentityFields } from './IdentityFields';
import { LoginFields } from './LoginFields';
import { PaymentCardFields } from './PaymentCardFields';
import { SecureNoteFields } from './SecureNoteFields';
import { TotpFields } from './TotpFields';

export type VaultItemType = VaultItem['type'];

export interface VaultItemFieldsEntry {
  schema: StandardSchemaV1<VaultItem>;
  Component: ComponentType<Record<string, unknown>>;
}

export const VAULT_ITEM_FIELDS_REGISTRY: Record<VaultItemType, VaultItemFieldsEntry> = {
  login: {
    schema: LoginItemSchema as StandardSchemaV1<VaultItem>,
    Component: LoginFields,
  },
  secure_note: {
    schema: SecureNoteSchema as StandardSchemaV1<VaultItem>,
    Component: SecureNoteFields,
  },
  payment_card: {
    schema: PaymentCardSchema as StandardSchemaV1<VaultItem>,
    Component: PaymentCardFields,
  },
  identity: {
    schema: IdentitySchema as StandardSchemaV1<VaultItem>,
    Component: IdentityFields,
  },
  totp: {
    schema: TotpItemSchema as StandardSchemaV1<VaultItem>,
    Component: TotpFields,
  },
  developer_credential: {
    schema: DeveloperCredentialItemSchema as StandardSchemaV1<VaultItem>,
    Component: DeveloperCredentialFields as ComponentType<Record<string, unknown>>,
  },
  crypto_wallet: {
    schema: CryptoWalletItemSchema as StandardSchemaV1<VaultItem>,
    Component: CryptoWalletFields,
  },
};
