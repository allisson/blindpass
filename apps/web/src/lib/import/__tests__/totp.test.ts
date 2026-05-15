import { describe, expect, it } from 'vitest';
import { parseTotpUri } from '../totp';

describe('parseTotpUri', () => {
  it('returns null for empty input', () => {
    expect(parseTotpUri('')).toBeNull();
    expect(parseTotpUri('   ')).toBeNull();
  });

  it('treats a bare base32 string as the secret', () => {
    expect(parseTotpUri('JBSWY3DPEHPK3PXP')).toEqual({ secret: 'JBSWY3DPEHPK3PXP' });
  });

  it('parses a typical otpauth URI with issuer:account label', () => {
    const result = parseTotpUri(
      'otpauth://totp/GitHub:alice@example.com?secret=JBSW&issuer=GitHub&algorithm=SHA256&digits=8&period=60',
    );
    expect(result).toEqual({
      secret: 'JBSW',
      issuer: 'GitHub',
      accountName: 'alice@example.com',
      algorithm: 'SHA256',
      digits: 8,
      period: 60,
    });
  });

  it('falls back to issuer-from-path when query issuer missing', () => {
    const result = parseTotpUri('otpauth://totp/Acme:bob?secret=ABC');
    expect(result).toMatchObject({ secret: 'ABC', issuer: 'Acme', accountName: 'bob' });
  });

  it('returns null when secret query param is missing', () => {
    expect(parseTotpUri('otpauth://totp/Acme:bob')).toBeNull();
  });

  it('treats non-otpauth strings as bare secrets', () => {
    expect(parseTotpUri('http://example.com/?secret=ABC')).toEqual({
      secret: 'http://example.com/?secret=ABC',
    });
  });

  it('defaults unknown algorithm to SHA1', () => {
    const result = parseTotpUri('otpauth://totp/x?secret=ABC&algorithm=weird');
    expect(result?.algorithm).toBe('SHA1');
  });

  it('omits algorithm when query param absent', () => {
    const result = parseTotpUri('otpauth://totp/x?secret=ABC');
    expect(result?.algorithm).toBeUndefined();
  });
});
