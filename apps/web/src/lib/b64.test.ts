import { describe, it, expect } from 'vitest';
import { toBase64, fromBase64, toBase64EncryptedValue, fromBase64EncryptedValue } from './b64';

describe('toBase64 / fromBase64', () => {
  it('round-trips arbitrary bytes', () => {
    const bytes = new Uint8Array([0, 1, 127, 128, 255]);
    expect(fromBase64(toBase64(bytes))).toEqual(bytes);
  });

  it('toBase64 produces valid base64 string', () => {
    expect(toBase64(new Uint8Array([104, 101, 108, 108, 111]))).toBe('aGVsbG8=');
  });

  it('fromBase64 decodes known base64', () => {
    expect(fromBase64('aGVsbG8=')).toEqual(new Uint8Array([104, 101, 108, 108, 111]));
  });

  it('handles empty array', () => {
    expect(toBase64(new Uint8Array([]))).toBe('');
    expect(fromBase64('')).toEqual(new Uint8Array([]));
  });
});

describe('toBase64EncryptedValue / fromBase64EncryptedValue', () => {
  it('round-trips an EncryptedValue', () => {
    const ev = {
      ciphertext: new Uint8Array([1, 2, 3]),
      nonce: new Uint8Array([4, 5, 6]),
    };
    const encoded = toBase64EncryptedValue(ev);
    expect(typeof encoded.ciphertext).toBe('string');
    expect(typeof encoded.nonce).toBe('string');
    const decoded = fromBase64EncryptedValue(encoded);
    expect(decoded.ciphertext).toEqual(ev.ciphertext);
    expect(decoded.nonce).toEqual(ev.nonce);
  });
});
