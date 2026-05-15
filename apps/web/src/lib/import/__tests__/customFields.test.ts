import { describe, expect, it } from 'vitest';
import { harvestCustomFields, isSecretKey } from '../customFields';

describe('harvestCustomFields', () => {
  it('returns empty for empty source', () => {
    expect(harvestCustomFields({}, new Set())).toEqual([]);
  });

  it('skips consumed keys', () => {
    const fields = harvestCustomFields({ username: 'alice', extra: 'foo' }, new Set(['username']));
    expect(fields).toEqual([{ label: 'Extra', value: 'foo' }]);
  });

  it('defensively blocks secret-bearing keys even if missing from consumed', () => {
    const fields = harvestCustomFields(
      { password: 'leaked', mnemonic: 'leaked', cvv: '123', notes: 'ok' },
      new Set(),
    );
    expect(fields).toEqual([{ label: 'Notes', value: 'ok' }]);
  });

  it('humanises camelCase / snake_case / kebab-case labels', () => {
    const fields = harvestCustomFields(
      { firstName: 'a', last_name: 'b', 'job-title': 'c' },
      new Set(),
    );
    expect(fields).toEqual([
      { label: 'First Name', value: 'a' },
      { label: 'Last Name', value: 'b' },
      { label: 'Job Title', value: 'c' },
    ]);
  });

  it('skips null, undefined, empty-string, and object values', () => {
    const fields = harvestCustomFields(
      { a: null, b: undefined, c: '', d: '   ', e: { nested: 1 }, f: 'ok' },
      new Set(),
    );
    expect(fields).toEqual([{ label: 'F', value: 'ok' }]);
  });

  it('stringifies numbers and booleans', () => {
    const fields = harvestCustomFields({ count: 42, active: true }, new Set());
    expect(fields).toEqual([
      { label: 'Count', value: '42' },
      { label: 'Active', value: 'true' },
    ]);
  });

  it('case-insensitive secret guard', () => {
    const fields = harvestCustomFields({ PASSWORD: 'leak', Mnemonic: 'leak' }, new Set());
    expect(fields).toEqual([]);
  });

  it('blocks separator-variant secret keys (substring match)', () => {
    const fields = harvestCustomFields(
      {
        master_password: 'leak',
        client_secret: 'leak',
        api_secret: 'leak',
        recoveryPhrase: 'leak',
        privateKey: 'leak',
        totpSecret: 'leak',
        card_pin: 'leak',
        card_cvv: 'leak',
        kept: 'ok',
      },
      new Set(),
    );
    expect(fields).toEqual([{ label: 'Kept', value: 'ok' }]);
  });
});

describe('isSecretKey', () => {
  it('matches known secret substrings (case-insensitive)', () => {
    for (const k of [
      'password',
      'Master_Password',
      'secret',
      'API_SECRET',
      'mnemonic',
      'recovery_phrase',
      'recoveryPhrase',
      'private_key',
      'privateKey',
      'totp',
      'totpSecret',
      'pin',
      'card_pin',
      'cvv',
      'card-cvv',
      'cvc',
    ]) {
      expect(isSecretKey(k), k).toBe(true);
    }
  });

  it('does not false-positive on innocent short tokens', () => {
    for (const k of ['pinterest', 'spinner', 'pinned', 'cardholder', 'notes', 'address']) {
      expect(isSecretKey(k), k).toBe(false);
    }
  });
});
