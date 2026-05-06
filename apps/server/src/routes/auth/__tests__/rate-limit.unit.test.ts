import { describe, expect, it } from 'vitest';
import { resolveAuthRateLimitMax } from '../rate-limit.js';

describe('auth rate-limit policy', () => {
  it('keeps production limits unchanged', () => {
    expect(resolveAuthRateLimitMax('production', 5)).toBe(5);
    expect(resolveAuthRateLimitMax('production', 20)).toBe(20);
  });

  it('relaxes non-production limits to avoid local auth lockouts', () => {
    expect(resolveAuthRateLimitMax('development', 5)).toBe(1000);
    expect(resolveAuthRateLimitMax('test', 20)).toBe(1000);
  });
});
