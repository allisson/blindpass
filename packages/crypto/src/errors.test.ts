import { describe, it, expect } from 'vitest';
import { CryptoError, DecryptionError } from './errors.js';

describe('CryptoError', () => {
  it('is instanceof Error and CryptoError with correct name', () => {
    const e = new CryptoError('decryption failed');
    expect(e).toBeInstanceOf(Error);
    expect(e).toBeInstanceOf(CryptoError);
    expect(e.message).toBe('decryption failed');
    expect(e.name).toBe('CryptoError');
  });
});

describe('DecryptionError', () => {
  it('is instanceof Error, CryptoError, and DecryptionError with correct name', () => {
    const e = new DecryptionError('bad key');
    expect(e).toBeInstanceOf(Error);
    expect(e).toBeInstanceOf(CryptoError);
    expect(e).toBeInstanceOf(DecryptionError);
    expect(e.message).toBe('bad key');
    expect(e.name).toBe('DecryptionError');
  });
});
