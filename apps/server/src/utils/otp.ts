import { createHash, createHmac, randomInt } from 'node:crypto';

/** Plain SHA-256 for high-entropy session tokens (256-bit random = full preimage resistance). */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** HMAC-SHA256 for low-entropy OTP tokens (6-digit = ~20 bits). */
export function hashOtpToken(token: string, secret: string): string {
  return createHmac('sha256', secret).update(token).digest('hex');
}

export function generateOtp(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, '0');
}
