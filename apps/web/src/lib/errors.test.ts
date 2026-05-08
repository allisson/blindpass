import { describe, expect, it } from 'vitest';
import { ApiError } from './api';
import { extractErrorMessage } from './errors';

describe('extractErrorMessage', () => {
  it('returns ApiError message', () => {
    const err = new ApiError(400, 'bad request');
    expect(extractErrorMessage(err)).toBe('bad request');
  });

  it('returns Error message', () => {
    expect(extractErrorMessage(new Error('standard error'))).toBe('standard error');
  });

  it('returns default fallback for non-Error unknown', () => {
    expect(extractErrorMessage('string error')).toBe('Something went wrong');
  });

  it('returns custom fallback for non-Error unknown', () => {
    expect(extractErrorMessage(42, 'custom fallback')).toBe('custom fallback');
  });
});
