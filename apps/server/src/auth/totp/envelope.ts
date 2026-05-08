import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { env } from '../../env.js';
import { b64 } from '../../utils/base64.js';

const IV_BYTES = 12;
const TAG_BYTES = 16;

function key(): Buffer {
  const k = b64(env.TOTP_SECRET_ENCRYPTION_KEY);
  if (k.length !== 32) {
    throw new Error('TOTP_SECRET_ENCRYPTION_KEY must decode to 32 bytes');
  }
  return k;
}

export function seal(plaintext: string): Buffer {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ciphertext]);
}

export function open(envelope: Buffer): string {
  const iv = envelope.subarray(0, IV_BYTES);
  const tag = envelope.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
  const ciphertext = envelope.subarray(IV_BYTES + TAG_BYTES);
  const decipher = createDecipheriv('aes-256-gcm', key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}
