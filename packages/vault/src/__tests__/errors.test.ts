import { describe, it, expect } from 'vitest';
import { ExportError } from '../errors.js';

describe('ExportError', () => {
  it('is instanceof Error and ExportError with correct name', () => {
    const e = new ExportError('bad export');
    expect(e).toBeInstanceOf(Error);
    expect(e).toBeInstanceOf(ExportError);
    expect(e.message).toBe('bad export');
    expect(e.name).toBe('ExportError');
  });
});
