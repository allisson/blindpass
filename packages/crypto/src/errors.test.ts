import { describe, it, expect } from 'vitest';
import { CryptoError } from './errors.js';

describe('CryptoError', () => {
  it('is instanceof Error and CryptoError with correct name', () => {
    const e = new CryptoError('decryption failed');
    expect(e).toBeInstanceOf(Error);
    expect(e).toBeInstanceOf(CryptoError);
    expect(e.message).toBe('decryption failed');
    expect(e.name).toBe('CryptoError');
  });
});
