import { describe, it, expect } from 'vitest';
import { passwordStrength } from './passwordStrength';

describe('passwordStrength', () => {
  it('returns 0 for empty string', () => {
    expect(passwordStrength('')).toBe(0);
  });

  it('returns 0 for password shorter than MIN_PASSWORD_LENGTH', () => {
    expect(passwordStrength('short')).toBe(0);
  });

  it('scores length >= MIN_PASSWORD_LENGTH', () => {
    expect(passwordStrength('aaaaaaaaaaaa')).toBeGreaterThanOrEqual(1);
  });

  it('scores length >= MIN_PASSWORD_LENGTH + 4 (password > 16 chars)', () => {
    const long = 'aaaaaaaaaaaaaaaa'; // 16 chars
    const score = passwordStrength(long);
    expect(score).toBeGreaterThanOrEqual(2);
  });

  it('scores uppercase + digit combination', () => {
    const score = passwordStrength('Aaaaaaaaaaaa1');
    expect(score).toBeGreaterThanOrEqual(2);
  });

  it('scores special character', () => {
    const score = passwordStrength('aaaaaaaaaaaa!');
    expect(score).toBeGreaterThanOrEqual(2);
  });

  it('returns 4 for a strong password', () => {
    expect(passwordStrength('Aaaaaaaaaaaaaaaa1!')).toBe(4);
  });
});
