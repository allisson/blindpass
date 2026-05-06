import { z } from 'zod';

export const CustomFieldSchema = z.object({
  label: z.string(),
  value: z.string(),
});

const customFields = { customFields: z.array(CustomFieldSchema).optional() };
const optionalUrl = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
  z.url().optional(),
);
const optionalTrimmedString = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
  z.string().optional(),
);

export const LoginItemSchema = z.object({
  type: z.literal('login'),
  title: z.string(),
  username: z.string(),
  password: z.string(),
  url: z.string().optional(),
  notes: z.string().optional(),
  ...customFields,
});

export const SecureNoteSchema = z.object({
  type: z.literal('secure_note'),
  title: z.string(),
  content: z.string(),
  ...customFields,
});

export const PaymentCardSchema = z.object({
  type: z.literal('payment_card'),
  title: z.string(),
  cardholderName: z.string(),
  number: z.string(),
  expMonth: z.string(),
  expYear: z.string(),
  cvv: z.string().optional(),
  notes: z.string().optional(),
  ...customFields,
});

export const IdentitySchema = z.object({
  type: z.literal('identity'),
  title: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  email: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  notes: z.string().optional(),
  ...customFields,
});

export const TotpItemSchema = z.object({
  type: z.literal('totp'),
  title: z.string().min(1),
  secret: z.string().min(1),
  issuer: z.string().optional(),
  accountName: z.string().optional(),
  algorithm: z.enum(['SHA1', 'SHA256', 'SHA512']).default('SHA1'),
  digits: z.number().int().min(6).max(8).default(6),
  period: z.number().int().min(15).max(300).default(30),
  notes: z.string().optional(),
  ...customFields,
});

const DeveloperCredentialItemBaseSchema = z.object({
  type: z.literal('developer_credential'),
  title: z.string(),
  notes: z.string().optional(),
  ...customFields,
});

const DeveloperCredentialApiBaseSchema = DeveloperCredentialItemBaseSchema.extend({
  title: z.string(),
  provider: z.string().min(1),
  environment: z.string().optional(),
  baseUrl: optionalUrl,
});

const DeveloperCredentialTokenSchema = DeveloperCredentialApiBaseSchema.extend({
  credentialMode: z.literal('token'),
  secret: z.string().min(1),
  keyId: z.string().optional(),
});

const DeveloperCredentialClientSecretPairSchema = DeveloperCredentialApiBaseSchema.extend({
  credentialMode: z.literal('client_secret_pair'),
  clientId: z.string().min(1),
  clientSecret: z.string().min(1),
});

const DeveloperCredentialSshKeySchema = DeveloperCredentialItemBaseSchema.extend({
  credentialMode: z.literal('ssh_key'),
  privateKey: z.string().min(1),
  publicKey: z.string().min(1),
  passphrase: optionalTrimmedString,
  username: z.string().min(1),
  host: z.string().min(1),
  algorithm: optionalTrimmedString,
  fingerprint: optionalTrimmedString,
}).superRefine((value, ctx) => {
  if (!value.algorithm && !value.fingerprint) {
    ctx.addIssue({
      code: 'custom',
      message: 'Algorithm or fingerprint is required',
      path: ['algorithm'],
    });
  }
});

export const DeveloperCredentialItemSchema = z.discriminatedUnion('credentialMode', [
  DeveloperCredentialTokenSchema,
  DeveloperCredentialClientSecretPairSchema,
  DeveloperCredentialSshKeySchema,
]);

const Bip39WalletSchema = z.object({
  type: z.literal('crypto_wallet'),
  walletMode: z.literal('bip39'),
  title: z.string(),
  mnemonic: z
    .string()
    .min(1)
    .refine((m) => [12, 15, 18, 21, 24].includes(m.trim().split(/\s+/).length), {
      message: 'Mnemonic must be 12, 15, 18, 21, or 24 words',
    }),
  passphrase: optionalTrimmedString,
  walletName: optionalTrimmedString,
  network: optionalTrimmedString,
  derivationPath: optionalTrimmedString.refine((p) => !p || /^m(\/\d+'?)+$/.test(p), {
    message: 'Invalid derivation path format',
  }),
  addressHint: z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
    z.string().max(20).optional(),
  ),
  notes: z.string().optional(),
  ...customFields,
});

export const CryptoWalletItemSchema = z.discriminatedUnion('walletMode', [Bip39WalletSchema]);

function normalizeLegacyVaultItem(value: unknown): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  const item = value as Record<string, unknown>;
  if (item.type === 'api_key') {
    return { ...item, type: 'developer_credential' };
  }
  return value;
}

export const VaultItemSchema = z.preprocess(
  normalizeLegacyVaultItem,
  z.discriminatedUnion('type', [
    LoginItemSchema,
    SecureNoteSchema,
    PaymentCardSchema,
    IdentitySchema,
    TotpItemSchema,
    DeveloperCredentialItemSchema,
    CryptoWalletItemSchema,
  ]),
);

export type CustomField = z.infer<typeof CustomFieldSchema>;
export type LoginItem = z.infer<typeof LoginItemSchema>;
export type SecureNote = z.infer<typeof SecureNoteSchema>;
export type PaymentCard = z.infer<typeof PaymentCardSchema>;
export type Identity = z.infer<typeof IdentitySchema>;
export type TotpItem = z.infer<typeof TotpItemSchema>;
export type DeveloperCredentialItem = z.infer<typeof DeveloperCredentialItemSchema>;
export type CryptoWalletItem = z.infer<typeof CryptoWalletItemSchema>;
export type VaultItem = z.infer<typeof VaultItemSchema>;
