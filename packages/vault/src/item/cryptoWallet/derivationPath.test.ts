import { describe, it, expect } from 'vitest';
import { isValidDerivationPath } from './derivationPath.js';

describe('isValidDerivationPath', () => {
  it.each(["m/44'/0'/0'/0/0", "m/44'", 'm/0', "m/44'/0"])('accepts valid path %s', (path) => {
    expect(isValidDerivationPath(path)).toBe(true);
  });

  it.each(['', 'invalid', 'm', 'm/', '/44/0', 'm/abc'])('rejects invalid path %s', (path) => {
    expect(isValidDerivationPath(path)).toBe(false);
  });
});
