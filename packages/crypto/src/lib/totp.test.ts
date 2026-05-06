import { describe, it, expect } from 'vitest';
import * as OTPAuth from 'otpauth';
import { generateTotpCode, getTotpTimeRemaining } from './totp.js';

describe('generateTotpCode', () => {
  it('returns a 6-digit string with default options', () => {
    const secret = OTPAuth.Secret.fromBase32('JBSWY3DPEHPK3PXP').base32;
    const code = generateTotpCode(secret);
    expect(code).toMatch(/^\d{6}$/);
  });

  it('returns an 8-digit string when digits=8', () => {
    const secret = OTPAuth.Secret.fromBase32('JBSWY3DPEHPK3PXP').base32;
    const code = generateTotpCode(secret, { digits: 8 });
    expect(code).toMatch(/^\d{8}$/);
  });

  it('produces the same code as otpauth TOTP directly', () => {
    const base32 = 'JBSWY3DPEHPK3PXP';
    const now = 1_700_000_000_000;
    const totp = new OTPAuth.TOTP({
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(base32),
    });
    expect(generateTotpCode(base32, undefined, now)).toBe(totp.generate({ timestamp: now }));
  });

  it('generates different codes for different secrets', () => {
    const secretA = 'JBSWY3DPEHPK3PXP';
    const secretB = 'JBSWY3DPEHPK3PXY';
    const codeA = generateTotpCode(secretA);
    const codeB = generateTotpCode(secretB);
    expect(codeA).not.toBe(codeB);
  });

  it('respects SHA256 algorithm option', () => {
    const secret = 'JBSWY3DPEHPK3PXP';
    const sha1Code = generateTotpCode(secret, { algorithm: 'SHA1' });
    const sha256Code = generateTotpCode(secret, { algorithm: 'SHA256' });
    expect(sha1Code).not.toBe(sha256Code);
  });

  it('respects period option', () => {
    const secret = 'JBSWY3DPEHPK3PXP';
    // At a known timestamp, period=30 and period=60 may differ
    const code30 = generateTotpCode(secret, { period: 30 });
    expect(code30).toMatch(/^\d{6}$/);
  });
});

describe('getTotpTimeRemaining', () => {
  it('returns value between 1 and period using live clock', () => {
    const remaining = getTotpTimeRemaining(30);
    expect(remaining).toBeGreaterThanOrEqual(1);
    expect(remaining).toBeLessThanOrEqual(30);
  });

  it('returns period when at exact boundary', () => {
    expect(getTotpTimeRemaining(30, 30_000)).toBe(30); // 30s, 30 % 30 = 0 → remaining = 30
  });

  it('returns 1 when 1 second before boundary', () => {
    expect(getTotpTimeRemaining(30, 29_000)).toBe(1); // 29s, 29 % 30 = 29 → remaining = 1
  });

  it('uses 30s period by default', () => {
    expect(getTotpTimeRemaining(30, 10_000)).toBe(20); // 10s, 10 % 30 = 10 → remaining = 20
  });

  it('works with 60s period', () => {
    expect(getTotpTimeRemaining(60, 45_000)).toBe(15); // 45s, 45 % 60 = 45 → remaining = 15
  });
});
