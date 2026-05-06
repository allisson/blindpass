import { describe, it, expect } from 'vitest';
import { parseOtpauthUri } from './totp.js';

const VALID_URI =
  'otpauth://totp/GitHub%3Auser%40example.com?secret=JBSWY3DPEHPK3PXP&issuer=GitHub&algorithm=SHA1&digits=6&period=30';

describe('parseOtpauthUri', () => {
  it('parses a full otpauth URI', () => {
    const result = parseOtpauthUri(VALID_URI);
    expect(result).toEqual({
      secret: 'JBSWY3DPEHPK3PXP',
      issuer: 'GitHub',
      accountName: 'user@example.com',
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
    });
  });

  it('returns null for non-otpauth protocol', () => {
    expect(parseOtpauthUri('https://example.com')).toBeNull();
  });

  it('returns null for hotp type', () => {
    expect(parseOtpauthUri('otpauth://hotp/test?secret=ABC&counter=0')).toBeNull();
  });

  it('returns null when secret is missing', () => {
    expect(parseOtpauthUri('otpauth://totp/test?issuer=Test')).toBeNull();
  });

  it('defaults algorithm to SHA1 when missing', () => {
    const result = parseOtpauthUri('otpauth://totp/test?secret=JBSWY3DPEHPK3PXP');
    expect(result?.algorithm).toBe('SHA1');
  });

  it('defaults algorithm to SHA1 for unsupported value', () => {
    const result = parseOtpauthUri('otpauth://totp/test?secret=ABC&algorithm=MD5');
    expect(result?.algorithm).toBe('SHA1');
  });

  it('parses SHA256 algorithm', () => {
    const result = parseOtpauthUri('otpauth://totp/test?secret=ABC&algorithm=SHA256');
    expect(result?.algorithm).toBe('SHA256');
  });

  it('defaults digits to 6 when missing', () => {
    const result = parseOtpauthUri('otpauth://totp/test?secret=ABC');
    expect(result?.digits).toBe(6);
  });

  it('parses 8-digit TOTP', () => {
    const result = parseOtpauthUri('otpauth://totp/test?secret=ABC&digits=8');
    expect(result?.digits).toBe(8);
  });

  it('defaults period to 30 when missing', () => {
    const result = parseOtpauthUri('otpauth://totp/test?secret=ABC');
    expect(result?.period).toBe(30);
  });

  it('parses accountName from label without colon', () => {
    const result = parseOtpauthUri('otpauth://totp/user%40example.com?secret=ABC');
    expect(result?.accountName).toBe('user@example.com');
  });

  it('parses accountName from label with issuer:account format', () => {
    const result = parseOtpauthUri('otpauth://totp/GitHub%3Auser%40example.com?secret=ABC');
    expect(result?.accountName).toBe('user@example.com');
  });

  it('returns null for malformed URI', () => {
    expect(parseOtpauthUri('not-a-uri')).toBeNull();
  });

  it('returns undefined accountName when label path is empty', () => {
    const result = parseOtpauthUri('otpauth://totp/?secret=JBSWY3DPEHPK3PXP');
    expect(result?.accountName).toBeUndefined();
  });
});
