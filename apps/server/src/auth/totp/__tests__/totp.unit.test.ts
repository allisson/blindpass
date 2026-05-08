import { describe, expect, it } from 'vitest';
import { generateTotpCode } from '@blindpass/crypto';
import { enroll, verify } from '../index.js';
import { open, seal } from '../envelope.js';
import { base32Encode } from '../base32.js';

const PERIOD = 30_000;

describe('totp.enroll', () => {
  it('produces a base32 plaintext, encrypted envelope, and otpauth URI', () => {
    const expiresAt = new Date('2030-01-01T00:00:00Z');
    const e = enroll('alice', expiresAt);
    expect(e.plaintextSecret).toMatch(/^[A-Z2-7]+$/);
    expect(e.encryptedSecret.length).toBeGreaterThan(28);
    expect(e.qrUri).toMatch(/^otpauth:\/\/totp\/BlindPass%3Aalice\?secret=[A-Z2-7]+&/);
    expect(e.expiresAt).toBe(expiresAt.toISOString());
  });

  it('round-trips through verify with a fresh code', () => {
    const e = enroll('bob', new Date(Date.now() + 60_000));
    const now = Date.now();
    const code = generateTotpCode(
      e.plaintextSecret,
      { algorithm: 'SHA1', digits: 6, period: 30 },
      now,
    );
    expect(verify(e.encryptedSecret, code, null, now)).not.toBeNull();
  });
});

describe('totp.verify', () => {
  const now = 1_700_000_000_000;
  const currentCounter = Math.floor(now / PERIOD);

  function codeAt(secret: string, t: number) {
    return generateTotpCode(secret, { algorithm: 'SHA1', digits: 6, period: 30 }, t);
  }

  it('accepts a code from the previous, current, and next window', () => {
    const e = enroll('c', new Date(now + 60_000));
    expect(verify(e.encryptedSecret, codeAt(e.plaintextSecret, now - PERIOD), null, now)).toBe(
      currentCounter - 1,
    );
    expect(verify(e.encryptedSecret, codeAt(e.plaintextSecret, now), null, now)).toBe(
      currentCounter,
    );
    expect(verify(e.encryptedSecret, codeAt(e.plaintextSecret, now + PERIOD), null, now)).toBe(
      currentCounter + 1,
    );
  });

  it('rejects a counter <= lastUsedCounter (replay protection)', () => {
    const e = enroll('d', new Date(now + 60_000));
    const code = codeAt(e.plaintextSecret, now);
    expect(verify(e.encryptedSecret, code, currentCounter, now)).toBeNull();
    expect(verify(e.encryptedSecret, code, currentCounter + 1, now)).toBeNull();
  });

  it('rejects a forged code', () => {
    const e = enroll('e', new Date(now + 60_000));
    expect(verify(e.encryptedSecret, '000000', null, now)).toBeNull();
  });

  it('rejects a code whose length does not match', () => {
    const e = enroll('f', new Date(now + 60_000));
    expect(verify(e.encryptedSecret, '12345', null, now)).toBeNull();
  });
});

describe('totp envelope', () => {
  it('seal/open round-trip', () => {
    const secret = base32Encode(Buffer.from('hello-world-padding!', 'utf8'));
    const env = seal(secret);
    expect(open(env)).toBe(secret);
  });

  it('open throws on tampered ciphertext', () => {
    const env = seal('JBSWY3DPEHPK3PXP');
    env[env.length - 1] ^= 0xff;
    expect(() => open(env)).toThrow();
  });
});

describe('base32Encode', () => {
  it('encodes RFC 4648 vectors', () => {
    expect(base32Encode(Buffer.from(''))).toBe('');
    expect(base32Encode(Buffer.from('f'))).toBe('MY======'.replace(/=/g, ''));
    expect(base32Encode(Buffer.from('foobar'))).toBe('MZXW6YTBOI======'.replace(/=/g, ''));
  });
});
