import * as OTPAuth from 'otpauth';

export interface TotpOptions {
  algorithm?: 'SHA1' | 'SHA256' | 'SHA512';
  digits?: number;
  period?: number;
}

export function generateTotpCode(secret: string, options?: TotpOptions, now?: number): string {
  const totp = new OTPAuth.TOTP({
    algorithm: options?.algorithm ?? 'SHA1',
    digits: options?.digits ?? 6,
    period: options?.period ?? 30,
    secret: OTPAuth.Secret.fromBase32(secret),
  });
  return totp.generate({ timestamp: now ?? Date.now() });
}

export function getTotpTimeRemaining(period: number = 30, now?: number): number {
  const t = now ?? Date.now();
  return period - (Math.floor(t / 1000) % period);
}
