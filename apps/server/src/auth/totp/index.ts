import { randomBytes, timingSafeEqual } from 'node:crypto';
import { generateTotpCode } from '@blindpass/crypto';
import { base32Encode } from './base32.js';
import { open, seal } from './envelope.js';

const PERIOD_SECONDS = 30;
const DIGITS = 6;
const SECRET_BYTES = 20;
const WINDOW_OFFSETS = [-1, 0, 1] as const;

export type TotpEnrollment = {
  plaintextSecret: string;
  encryptedSecret: Buffer;
  qrUri: string;
  expiresAt: string;
};

export function enroll(username: string, expiresAt: Date): TotpEnrollment {
  const plaintextSecret = base32Encode(randomBytes(SECRET_BYTES));
  return {
    plaintextSecret,
    encryptedSecret: seal(plaintextSecret),
    qrUri:
      `otpauth://totp/${encodeURIComponent(`BlindPass:${username}`)}` +
      `?secret=${plaintextSecret}&issuer=BlindPass&algorithm=SHA1&digits=${DIGITS}&period=${PERIOD_SECONDS}`,
    expiresAt: expiresAt.toISOString(),
  };
}

export function verify(
  encryptedSecret: Buffer,
  code: string,
  lastUsedCounter: number | null | undefined,
  now: number = Date.now(),
): number | null {
  const secret = open(encryptedSecret);
  const currentCounter = Math.floor(now / (PERIOD_SECONDS * 1000));
  for (const offset of WINDOW_OFFSETS) {
    const counter = currentCounter + offset;
    if (lastUsedCounter != null && counter <= lastUsedCounter) continue;
    const expected = generateTotpCode(
      secret,
      { algorithm: 'SHA1', digits: DIGITS, period: PERIOD_SECONDS },
      counter * PERIOD_SECONDS * 1000,
    );
    if (expected.length !== code.length) continue;
    if (timingSafeEqual(Buffer.from(expected), Buffer.from(code))) {
      return counter;
    }
  }
  return null;
}
