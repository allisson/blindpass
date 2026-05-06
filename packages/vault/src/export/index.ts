import {
  getSodium,
  deriveKeyEncryptionKey,
  encryptSymmetric,
  decryptSymmetric,
  generateSalt,
} from '@blindpass/crypto';
import { VaultItemSchema, type VaultItem } from '../item/schema.js';
import { ExportError } from '../errors.js';

interface PlaintextExport {
  version: 1;
  type: 'blindpass-export';
  exportedAt: string;
  items: VaultItem[];
}

interface EncryptedExport {
  version: 1;
  type: 'blindpass-export-encrypted';
  kekSalt: string;
  nonce: string;
  ciphertext: string;
}

function uint8ToBase64(arr: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < arr.length; i++) {
    binary += String.fromCharCode(arr[i]!);
  }
  return btoa(binary);
}

function base64ToUint8(str: string): Uint8Array {
  return Uint8Array.from(atob(str), (c) => c.charCodeAt(0));
}

export async function exportVaultPlaintext(items: VaultItem[]): Promise<string> {
  const payload: PlaintextExport = {
    version: 1,
    type: 'blindpass-export',
    exportedAt: new Date().toISOString(),
    items,
  };
  return JSON.stringify(payload, null, 2);
}

export async function exportVaultEncrypted(
  items: VaultItem[],
  passphrase: string,
): Promise<string> {
  const sodium = await getSodium();
  const plaintext = await exportVaultPlaintext(items);
  const kekSalt = await generateSalt();
  const kek = await deriveKeyEncryptionKey(passphrase, kekSalt);
  try {
    const encrypted = await encryptSymmetric(new TextEncoder().encode(plaintext), kek);
    const payload: EncryptedExport = {
      version: 1,
      type: 'blindpass-export-encrypted',
      kekSalt: uint8ToBase64(kekSalt),
      nonce: uint8ToBase64(encrypted.nonce),
      ciphertext: uint8ToBase64(encrypted.ciphertext),
    };
    return JSON.stringify(payload);
  } finally {
    sodium.memzero(kek);
  }
}

export async function importVaultPlaintext(json: string): Promise<VaultItem[]> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new ExportError('Not a valid BlindPass export file');
  }

  const data = parsed as Record<string, unknown>;

  if (data['type'] !== 'blindpass-export') {
    throw new ExportError('Not a valid BlindPass export file');
  }
  if (data['version'] !== 1) {
    throw new ExportError('Export version not supported');
  }

  const rawItems = data['items'];
  if (!Array.isArray(rawItems)) {
    throw new ExportError('Not a valid BlindPass export file');
  }

  return rawItems.map((entry: unknown, i: number) => {
    const result = VaultItemSchema.safeParse(entry);
    if (!result.success) {
      throw new ExportError(`Item ${i} is invalid: ${result.error.message}`);
    }
    return result.data;
  });
}

export async function importVaultEncrypted(json: string, passphrase: string): Promise<VaultItem[]> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new ExportError('Not a valid BlindPass export file');
  }

  const data = parsed as Record<string, unknown>;

  if (data['type'] !== 'blindpass-export-encrypted') {
    throw new ExportError('Not a valid BlindPass export file');
  }
  if (data['version'] !== 1) {
    throw new ExportError('Export version not supported');
  }

  const rawSalt = data['kekSalt'];
  const rawNonce = data['nonce'];
  const rawCiphertext = data['ciphertext'];
  if (
    typeof rawSalt !== 'string' ||
    typeof rawNonce !== 'string' ||
    typeof rawCiphertext !== 'string'
  ) {
    throw new ExportError('Not a valid BlindPass export file');
  }

  let kekSalt: Uint8Array;
  let nonce: Uint8Array;
  let ciphertext: Uint8Array;
  try {
    kekSalt = base64ToUint8(rawSalt);
    nonce = base64ToUint8(rawNonce);
    ciphertext = base64ToUint8(rawCiphertext);
  } catch {
    throw new ExportError('Not a valid BlindPass export file');
  }

  const sodium = await getSodium();
  const kek = await deriveKeyEncryptionKey(passphrase, kekSalt);
  let plaintextBytes: Uint8Array;
  try {
    plaintextBytes = await decryptSymmetric({ ciphertext, nonce }, kek);
  } catch {
    sodium.memzero(kek);
    throw new ExportError('Incorrect passphrase');
  }
  sodium.memzero(kek);

  return importVaultPlaintext(new TextDecoder().decode(plaintextBytes));
}
