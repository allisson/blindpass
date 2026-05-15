import { VaultItemSchema } from '@blindpass/vault';
import type { CustomField, VaultItem } from '@blindpass/vault';
import { coerceToSecureNote } from '../coerce';
import { isSecretKey } from '../customFields';
import { parseTotpUri } from '../totp';
import type { ImportResult } from '../types';
import { readZip } from '../zip';

type RawValue = Record<string, unknown> | undefined;

interface RawField {
  title?: string;
  name?: string;
  designation?: string;
  value?: RawValue;
}

interface RawSection {
  title?: string;
  name?: string;
  fields?: RawField[];
}

interface RawItem {
  uuid?: string;
  categoryUuid?: string;
  overview?: {
    title?: string;
    subtitle?: string;
    url?: string;
    urls?: { url?: string }[];
    tags?: string[];
  };
  details?: {
    loginFields?: RawField[];
    sections?: RawSection[];
    notesPlain?: string;
    passwordHistory?: unknown;
  };
  files?: { fileName?: string }[];
}

interface ExtractedFields {
  flat: Record<string, string>;
  totp?: string;
  notes?: string;
  attachments: string[];
}

function asString(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function readFieldValue(value: RawValue): { text: string; isTotp: boolean } {
  if (!value || typeof value !== 'object') return { text: '', isTotp: false };
  const v = value as Record<string, unknown>;
  if (typeof v.totp === 'string') return { text: v.totp, isTotp: true };
  for (const k of ['string', 'concealed', 'email', 'url', 'phone', 'date', 'monthYear']) {
    if (typeof v[k] === 'string') return { text: v[k] as string, isTotp: false };
  }
  // 1Password "address" is an object — flatten to a single-line string.
  if (v.address && typeof v.address === 'object') {
    const a = v.address as Record<string, unknown>;
    return {
      text: [a.street, a.city, a.state, a.country, a.zip].filter(Boolean).join(', '),
      isTotp: false,
    };
  }
  return { text: '', isTotp: false };
}

function fieldKey(field: RawField): string {
  return (field.designation || field.name || field.title || '').trim();
}

function extractFields(item: RawItem): ExtractedFields {
  const flat: Record<string, string> = {};
  let totp: string | undefined;
  const overview = item.overview ?? {};
  const details = item.details ?? {};

  for (const f of details.loginFields ?? []) {
    const key = fieldKey(f);
    if (!key) continue;
    const { text } = readFieldValue(f.value);
    if (text) flat[key] = text;
  }

  for (const section of details.sections ?? []) {
    for (const f of section.fields ?? []) {
      const key = fieldKey(f);
      if (!key) continue;
      const { text, isTotp } = readFieldValue(f.value);
      if (isTotp && text) {
        totp = totp || text;
      } else if (text) {
        flat[key] = text;
      }
    }
  }

  if (overview.url && !flat.url) flat.url = overview.url;
  if (overview.urls && Array.isArray(overview.urls)) {
    const u = overview.urls.find((x) => x?.url)?.url;
    if (u && !flat.url) flat.url = u;
  }

  const attachments = (item.files ?? []).map((f) => asString(f.fileName)).filter((n) => !!n);

  return {
    flat,
    totp,
    notes: details.notesPlain || undefined,
    attachments,
  };
}

function flatToCustomFields(flat: Record<string, string>, consumed: Set<string>): CustomField[] {
  const fields: CustomField[] = [];
  for (const [key, value] of Object.entries(flat)) {
    if (consumed.has(key)) continue;
    if (isSecretKey(key)) continue;
    if (!value) continue;
    fields.push({ label: humanizeLabel(key), value });
  }
  return fields;
}

function humanizeLabel(key: string): string {
  return key
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .trim()
    .replace(/\b(\w)/g, (c) => c.toUpperCase());
}

function attachmentsBreadcrumb(attachments: string[]): string | undefined {
  if (!attachments.length) return undefined;
  return `[Lost attachments: ${attachments.join(', ')}]`;
}

function appendBreadcrumb(
  notes: string | undefined,
  breadcrumb: string | undefined,
): string | undefined {
  if (!breadcrumb) return notes;
  return notes ? `${notes}\n\n${breadcrumb}` : breadcrumb;
}

const CATEGORY_NAMES: Record<string, string> = {
  '001': 'Login',
  '002': 'Credit Card',
  '003': 'Secure Note',
  '004': 'Identity',
  '005': 'Password',
  '100': 'Software License',
  '101': 'Bank Account',
  '102': 'Database',
  '103': "Driver's License",
  '104': 'Outdoor License',
  '105': 'Membership',
  '106': 'Passport',
  '107': 'Rewards Program',
  '108': 'Social Security Number',
  '109': 'Wireless Router',
  '110': 'Server',
  '111': 'Email Account',
  '112': 'API Credential',
  '113': 'Medical Record',
  '114': 'SSH Key',
  '115': 'Document',
};

function categoryName(uuid: string | undefined): string {
  if (!uuid) return 'Unknown';
  return CATEGORY_NAMES[uuid] ?? uuid;
}

interface Mapped {
  primary: VaultItem | null;
  paired?: VaultItem | null;
  attachmentsDropped: number;
}

function emitTotp(title: string, totpUri: string): VaultItem | null {
  const totp = parseTotpUri(totpUri);
  if (!totp) return null;
  const result = VaultItemSchema.safeParse({
    type: 'totp',
    title: title || totp.issuer || totp.accountName || 'TOTP',
    secret: totp.secret,
    issuer: totp.issuer,
    accountName: totp.accountName,
    algorithm: totp.algorithm,
    digits: totp.digits,
    period: totp.period,
  });
  return result.success ? result.data : null;
}

function mapLogin(title: string, ex: ExtractedFields, breadcrumb: string | undefined): Mapped {
  const consumed = new Set(['username', 'password', 'url']);
  const fields = flatToCustomFields(ex.flat, consumed);
  const result = VaultItemSchema.safeParse({
    type: 'login',
    title,
    username: ex.flat.username || '',
    password: ex.flat.password || '',
    url: ex.flat.url || undefined,
    notes: appendBreadcrumb(ex.notes, breadcrumb),
    customFields: fields.length ? fields : undefined,
  });
  return {
    primary: result.success ? result.data : null,
    paired: ex.totp ? emitTotp(title, ex.totp) : null,
    attachmentsDropped: ex.attachments.length,
  };
}

function mapPaymentCard(
  title: string,
  ex: ExtractedFields,
  breadcrumb: string | undefined,
): Mapped {
  const f = ex.flat;
  // 1Password typical keys: cardholder, ccnum (or number), cvv, expiry (MMYY), validFrom.
  const number = f.ccnum || f.number || '';
  if (!number) return mapCoerced(title, 'Credit Card', ex, breadcrumb);
  const expiry = f.expiry || f.expiration || '';
  let expMonth = '';
  let expYear = '';
  if (/^\d{6}$/.test(expiry)) {
    expYear = expiry.slice(0, 4);
    expMonth = expiry.slice(4, 6);
  } else if (/^\d{4}$/.test(expiry)) {
    expMonth = expiry.slice(0, 2);
    expYear = expiry.slice(2);
  } else if (/^(\d{4})-(\d{1,2})$/.test(expiry)) {
    const m = expiry.match(/^(\d{4})-(\d{1,2})$/)!;
    expYear = m[1];
    expMonth = m[2];
  }
  const consumed = new Set(['ccnum', 'number', 'cardholder', 'cvv', 'expiry', 'expiration']);
  const fields = flatToCustomFields(f, consumed);
  const result = VaultItemSchema.safeParse({
    type: 'payment_card',
    title,
    cardholderName: f.cardholder || '',
    number,
    expMonth,
    expYear,
    cvv: f.cvv || undefined,
    notes: appendBreadcrumb(ex.notes, breadcrumb),
    customFields: fields.length ? fields : undefined,
  });
  return {
    primary: result.success ? result.data : null,
    attachmentsDropped: ex.attachments.length,
  };
}

function mapSecureNote(title: string, ex: ExtractedFields, breadcrumb: string | undefined): Mapped {
  const fields = flatToCustomFields(ex.flat, new Set());
  const content = appendBreadcrumb(ex.notes, breadcrumb) ?? '';
  const result = VaultItemSchema.safeParse({
    type: 'secure_note',
    title,
    content,
    customFields: fields.length ? fields : undefined,
  });
  return {
    primary: result.success ? result.data : null,
    attachmentsDropped: ex.attachments.length,
  };
}

function mapIdentity(title: string, ex: ExtractedFields, breadcrumb: string | undefined): Mapped {
  const f = ex.flat;
  const firstName = f.firstname || f.firstName || '';
  const lastName = f.lastname || f.lastName || '';
  if (!firstName || !lastName) {
    return mapCoerced(title, 'Identity', ex, breadcrumb);
  }
  const consumed = new Set([
    'firstname',
    'firstName',
    'lastname',
    'lastName',
    'email',
    'defphone',
    'homephone',
    'cellphone',
    'address',
    'city',
    'country',
  ]);
  const fields = flatToCustomFields(f, consumed);
  const result = VaultItemSchema.safeParse({
    type: 'identity',
    title,
    firstName,
    lastName,
    email: f.email || undefined,
    phone: f.cellphone || f.defphone || f.homephone || undefined,
    address: f.address || undefined,
    city: f.city || undefined,
    country: f.country || undefined,
    notes: appendBreadcrumb(ex.notes, breadcrumb),
    customFields: fields.length ? fields : undefined,
  });
  return {
    primary: result.success ? result.data : null,
    attachmentsDropped: ex.attachments.length,
  };
}

function mapPassword(title: string, ex: ExtractedFields, breadcrumb: string | undefined): Mapped {
  // 1Password "Password" category: password without username.
  return mapLogin(title, { ...ex, flat: { ...ex.flat, username: '' } }, breadcrumb);
}

function mapSshKey(title: string, ex: ExtractedFields, breadcrumb: string | undefined): Mapped {
  const f = ex.flat;
  const privateKey = f.private_key || f.privateKey || '';
  const publicKey = f.public_key || f.publicKey || '';
  const fingerprint = f.fingerprint || f.key_fingerprint || '';
  if (!privateKey || !publicKey || !fingerprint) {
    return mapCoerced(title, 'SSH Key', ex, breadcrumb);
  }
  const username = f.username || 'imported';
  const host = f.hostname || f.host || 'imported';
  const consumed = new Set([
    'private_key',
    'privateKey',
    'public_key',
    'publicKey',
    'fingerprint',
    'key_fingerprint',
    'username',
    'hostname',
    'host',
    'passphrase',
    'algorithm',
    'key_type',
  ]);
  const fields = flatToCustomFields(f, consumed);
  const payload: Record<string, unknown> = {
    type: 'developer_credential',
    credentialMode: 'ssh_key',
    title,
    privateKey,
    publicKey,
    username,
    host,
    passphrase: f.passphrase || undefined,
    algorithm: f.algorithm || f.key_type || undefined,
    fingerprint,
    notes: appendBreadcrumb(ex.notes, breadcrumb),
  };
  if (fields.length) payload.customFields = fields;
  const result = VaultItemSchema.safeParse(payload);
  if (!result.success) return mapCoerced(title, 'SSH Key', ex, breadcrumb);
  return { primary: result.data, attachmentsDropped: ex.attachments.length };
}

function mapApiCredential(
  title: string,
  ex: ExtractedFields,
  breadcrumb: string | undefined,
): Mapped {
  const f = ex.flat;
  const clientId = f.username || f.client_id || f.clientId || '';
  const clientSecret = f.credential || f.client_secret || f.clientSecret || '';
  const token = f.credential || f.api_key || f.apiKey || f.secret || '';
  const provider = f.hostname || f.type || title || 'imported';
  const baseConsumed = new Set([
    'username',
    'credential',
    'client_id',
    'clientId',
    'client_secret',
    'clientSecret',
    'api_key',
    'apiKey',
    'secret',
    'hostname',
    'type',
    'filename',
    'valid_from',
    'expires',
  ]);
  const fields = flatToCustomFields(f, baseConsumed);

  if (clientId && f.client_secret) {
    const result = VaultItemSchema.safeParse({
      type: 'developer_credential',
      credentialMode: 'client_secret_pair',
      title,
      provider,
      clientId,
      clientSecret,
      notes: appendBreadcrumb(ex.notes, breadcrumb),
      customFields: fields.length ? fields : undefined,
    });
    if (result.success) return { primary: result.data, attachmentsDropped: ex.attachments.length };
  }

  if (token) {
    const result = VaultItemSchema.safeParse({
      type: 'developer_credential',
      credentialMode: 'token',
      title,
      provider,
      secret: token,
      notes: appendBreadcrumb(ex.notes, breadcrumb),
      customFields: fields.length ? fields : undefined,
    });
    if (result.success) return { primary: result.data, attachmentsDropped: ex.attachments.length };
  }

  return mapCoerced(title, 'API Credential', ex, breadcrumb);
}

function mapCryptoWallet(
  title: string,
  ex: ExtractedFields,
  breadcrumb: string | undefined,
): Mapped {
  const f = ex.flat;
  const mnemonicRaw = f.recovery_phrase || f.recoveryPhrase || f.mnemonic || '';
  const mnemonic = mnemonicRaw.trim().split(/\s+/).filter(Boolean).join(' ');
  const wordCount = mnemonic.split(' ').filter(Boolean).length;
  if (!mnemonic || ![12, 15, 18, 21, 24].includes(wordCount)) {
    return mapCoerced(title, 'Crypto Wallet', ex, breadcrumb);
  }
  const derivationPath = f.derivation_path || f.derivationPath || '';
  const validPath = /^m(\/\d+'?)+$/.test(derivationPath) ? derivationPath : undefined;
  const consumed = new Set([
    'recovery_phrase',
    'recoveryPhrase',
    'mnemonic',
    'derivation_path',
    'derivationPath',
    'passphrase',
    'wallet_name',
    'walletName',
    'network',
    'address_hint',
    'addressHint',
  ]);
  const fields = flatToCustomFields(f, consumed);
  const payload: Record<string, unknown> = {
    type: 'crypto_wallet',
    walletMode: 'bip39',
    title,
    mnemonic,
    passphrase: f.passphrase || undefined,
    walletName: f.wallet_name || f.walletName || undefined,
    network: f.network || undefined,
    derivationPath: validPath,
    addressHint: f.address_hint || f.addressHint || undefined,
    notes: appendBreadcrumb(ex.notes, breadcrumb),
  };
  if (fields.length) payload.customFields = fields;
  const result = VaultItemSchema.safeParse(payload);
  if (!result.success) return mapCoerced(title, 'Crypto Wallet', ex, breadcrumb);
  return { primary: result.data, attachmentsDropped: ex.attachments.length };
}

function mapCoerced(
  title: string,
  category: string,
  ex: ExtractedFields,
  breadcrumb: string | undefined,
): Mapped {
  const fields = flatToCustomFields(ex.flat, new Set());
  const coerced = coerceToSecureNote({
    categoryName: category,
    title,
    customFields: fields,
    sourceNotes: ex.notes,
    extraContent: breadcrumb,
  });
  return { primary: coerced, attachmentsDropped: ex.attachments.length };
}

function mapItem(item: RawItem): Mapped {
  const title = asString(item.overview?.title) || '(untitled)';
  const ex = extractFields(item);
  const breadcrumb = attachmentsBreadcrumb(ex.attachments);
  const category = item.categoryUuid;
  // Content-based fallback: any item with a recovery phrase → try crypto_wallet.
  // Lets us catch wallet-shaped items even when 1Password's category UUID for
  // crypto wallets isn't recognised.
  if (ex.flat.recovery_phrase || ex.flat.recoveryPhrase || ex.flat.mnemonic) {
    const mapped = mapCryptoWallet(title, ex, breadcrumb);
    if (mapped.primary) return mapped;
  }
  switch (category) {
    case '001':
      return mapLogin(title, ex, breadcrumb);
    case '002':
      return mapPaymentCard(title, ex, breadcrumb);
    case '003':
      return mapSecureNote(title, ex, breadcrumb);
    case '004':
      return mapIdentity(title, ex, breadcrumb);
    case '005':
      return mapPassword(title, ex, breadcrumb);
    case '114':
      return mapSshKey(title, ex, breadcrumb);
    case '112':
      return mapApiCredential(title, ex, breadcrumb);
    default:
      return mapCoerced(title, categoryName(category), ex, breadcrumb);
  }
}

interface ExportData {
  accounts?: { vaults?: { items?: RawItem[] }[] }[];
}

export async function parse(bytes: Uint8Array): Promise<ImportResult> {
  const entries = await readZip(bytes);
  const dataBytes = entries.get('export.data');
  if (!dataBytes) {
    throw new Error('Invalid .1pux — missing export.data');
  }
  let data: ExportData;
  try {
    data = JSON.parse(new TextDecoder().decode(dataBytes)) as ExportData;
  } catch {
    throw new Error('Invalid .1pux — export.data is not valid JSON');
  }

  const items: VaultItem[] = [];
  let skipped = 0;
  let attachmentsDropped = 0;

  for (const account of data.accounts ?? []) {
    for (const vault of account.vaults ?? []) {
      for (const item of vault.items ?? []) {
        const mapped = mapItem(item);
        if (mapped.primary) items.push(mapped.primary);
        else skipped++;
        if (mapped.paired) items.push(mapped.paired);
        attachmentsDropped += mapped.attachmentsDropped;
      }
    }
  }

  return { items, skipped, attachmentsDropped };
}

export const __internal = { mapItem };
