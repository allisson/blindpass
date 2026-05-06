import { describe, it, expect, beforeEach } from 'vitest';
import { loadZxcvbn, resetZxcvbnForTests } from './zxcvbn';

beforeEach(() => {
  resetZxcvbnForTests();
});

describe('loadZxcvbn', () => {
  it('memoises the estimator promise across calls', async () => {
    const a = loadZxcvbn();
    const b = loadZxcvbn();
    expect(a).toBe(b);
    await a;
  });

  it('scores common passwords below 3', async () => {
    const estimate = await loadZxcvbn();
    expect(estimate('password').score).toBeLessThan(3);
    expect(estimate('123456').score).toBeLessThan(3);
    expect(estimate('qwerty').score).toBeLessThan(3);
  });

  it('scores leetspeak variants of common passwords below 3', async () => {
    const estimate = await loadZxcvbn();
    expect(estimate('P@ssw0rd123').score).toBeLessThan(3);
  });

  it('scores a long random-looking phrase at 3 or above', async () => {
    const estimate = await loadZxcvbn();
    expect(estimate('correct horse battery staple').score).toBeGreaterThanOrEqual(3);
  });

  it('penalises passwords containing the email local-part', async () => {
    const estimate = await loadZxcvbn();
    const baseline = estimate('zxcvbnTestDecoyTesting9912', []);
    const penalised = estimate('zxcvbnTestDecoyTesting9912', [
      'zxcvbnTestDecoyTesting@example.com',
    ]);
    expect(penalised.score).toBeLessThanOrEqual(baseline.score);
  });

  it('ignores empty user inputs and short email tokens', async () => {
    const estimate = await loadZxcvbn();
    const baseline = estimate('zxcvbnTestDecoyTesting9912', []);
    const withIgnoredInputs = estimate('zxcvbnTestDecoyTesting9912', ['', 'ab@example.com']);
    expect(withIgnoredInputs.score).toBe(baseline.score);
  });

  it('returns a crack-time display string', async () => {
    const estimate = await loadZxcvbn();
    const r = estimate('correct horse battery staple');
    expect(typeof r.crackTimeDisplay).toBe('string');
    expect(r.crackTimeDisplay.length).toBeGreaterThan(0);
  });

  it('exposes the first suggestion as suggestion', async () => {
    const estimate = await loadZxcvbn();
    const r = estimate('password');
    // weak password produces feedback
    expect(r.warning.length + r.suggestion.length).toBeGreaterThan(0);
  });
});
