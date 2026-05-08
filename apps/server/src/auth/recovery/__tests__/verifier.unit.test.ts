import { describe, expect, it } from 'vitest';
import { hash, verify } from '../verifier.js';

describe('recovery verifier', () => {
  it('hash + verify round-trips for the same input + salt', () => {
    const { hash: h, salt } = hash('correct horse battery staple');
    expect(verify('correct horse battery staple', h, salt)).toBe(true);
  });

  it('rejects wrong verifier', () => {
    const { hash: h, salt } = hash('a');
    expect(verify('b', h, salt)).toBe(false);
  });

  it('rejects when expectedHash is null', () => {
    expect(verify('a', null, Buffer.alloc(16))).toBe(false);
  });

  it('rejects when salt is null', () => {
    const { hash: h } = hash('a');
    expect(verify('a', h, null)).toBe(false);
  });

  it('produces different hashes for the same input under different salts', () => {
    const a = hash('same');
    const b = hash('same');
    expect(a.hash).not.toBe(b.hash);
  });

  it('uses caller-supplied salt when provided', () => {
    const salt = Buffer.alloc(16, 7);
    const { hash: h, salt: outSalt } = hash('x', salt);
    expect(outSalt.equals(salt)).toBe(true);
    expect(verify('x', h, salt)).toBe(true);
  });
});
