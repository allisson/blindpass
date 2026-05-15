import { describe, expect, it } from 'vitest';
import { parse } from '../parsers/protonpass';

function bundle(items: unknown[]) {
  return JSON.stringify({
    version: '1.0.0',
    userId: 'u',
    vaults: {
      v1: { name: 'Personal', items },
    },
  });
}

describe('protonpass parser', () => {
  it('throws on invalid JSON', () => {
    expect(() => parse('not json')).toThrow();
  });

  it('throws when top-level vaults is missing', () => {
    expect(() => parse('{}')).toThrow();
  });

  it('maps login items and splits TOTP', () => {
    const raw = bundle([
      {
        itemId: 'i1',
        data: {
          type: 'login',
          metadata: { name: 'GitHub', note: 'work account' },
          content: {
            itemUsername: 'alice',
            itemEmail: 'alice@example.com',
            password: 'secret',
            urls: ['https://github.com'],
            totpUri: 'otpauth://totp/GitHub:alice?secret=JBSW&issuer=GitHub',
          },
          extraFields: [],
        },
      },
    ]);
    const { items, skipped } = parse(raw);
    expect(skipped).toBe(0);
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      type: 'login',
      title: 'GitHub',
      username: 'alice',
      password: 'secret',
      url: 'https://github.com',
      notes: 'work account',
    });
    expect(items[1]).toMatchObject({ type: 'totp', secret: 'JBSW', issuer: 'GitHub' });
  });

  it('falls back to itemEmail when itemUsername empty', () => {
    const raw = bundle([
      {
        data: {
          type: 'login',
          metadata: { name: 'X' },
          content: { itemUsername: '', itemEmail: 'a@b.com', password: 'p', urls: [] },
        },
      },
    ]);
    const { items } = parse(raw);
    expect(items[0]).toMatchObject({ username: 'a@b.com' });
  });

  it('maps note items', () => {
    const raw = bundle([
      { data: { type: 'note', metadata: { name: 'My Note', note: 'body' }, content: {} } },
    ]);
    const { items } = parse(raw);
    expect(items[0]).toMatchObject({ type: 'secure_note', title: 'My Note', content: 'body' });
  });

  it('maps creditCard with YYYY-MM expiration', () => {
    const raw = bundle([
      {
        data: {
          type: 'creditCard',
          metadata: { name: 'Visa' },
          content: {
            cardholderName: 'A. Person',
            number: '4111111111111111',
            expirationDate: '2027-03',
            verificationNumber: '123',
          },
        },
      },
    ]);
    const { items } = parse(raw);
    expect(items[0]).toMatchObject({
      type: 'payment_card',
      expMonth: '03',
      expYear: '2027',
      cvv: '123',
    });
  });

  it('maps identity natively when firstName + lastName present', () => {
    const raw = bundle([
      {
        data: {
          type: 'identity',
          metadata: { name: 'Me' },
          content: {
            firstName: 'Alice',
            lastName: 'Smith',
            email: 'a@b.com',
            city: 'NYC',
            occupation: 'Engineer',
          },
        },
      },
    ]);
    const { items } = parse(raw);
    expect(items[0]).toMatchObject({
      type: 'identity',
      firstName: 'Alice',
      lastName: 'Smith',
      email: 'a@b.com',
      city: 'NYC',
    });
    expect((items[0] as { customFields?: { label: string }[] }).customFields).toEqual([
      { label: 'Occupation', value: 'Engineer' },
    ]);
  });

  it('splits fullName when firstName/lastName missing', () => {
    const raw = bundle([
      {
        data: {
          type: 'identity',
          metadata: { name: 'Me' },
          content: { fullName: 'Alice Bob Smith' },
        },
      },
    ]);
    const { items } = parse(raw);
    expect(items[0]).toMatchObject({
      type: 'identity',
      firstName: 'Alice',
      lastName: 'Bob Smith',
    });
  });

  it('coerces identity when only single-word fullName', () => {
    const raw = bundle([
      {
        data: {
          type: 'identity',
          metadata: { name: 'Anon' },
          content: { fullName: 'Anonymous' },
        },
      },
    ]);
    const { items, skipped } = parse(raw);
    expect(skipped).toBe(0);
    expect(items[0]).toMatchObject({ type: 'secure_note', title: '[Identity] Anon' });
  });

  it('drops alias items as skipped', () => {
    const raw = bundle([
      { data: { type: 'alias', metadata: { name: 'a@proton.me' }, content: {} } },
    ]);
    const { items, skipped } = parse(raw);
    expect(items).toHaveLength(0);
    expect(skipped).toBe(1);
  });

  it('coerces unknown types', () => {
    const raw = bundle([
      {
        data: {
          type: 'sshKey',
          metadata: { name: 'My Key' },
          content: { something: 'value' },
        },
      },
    ]);
    const { items } = parse(raw);
    expect(items[0]).toMatchObject({
      type: 'secure_note',
      title: '[Proton sshKey] My Key',
    });
  });

  it('skips items missing data block', () => {
    const raw = bundle([{ itemId: 'x' }]);
    const { items, skipped } = parse(raw);
    expect(items).toHaveLength(0);
    expect(skipped).toBe(1);
  });

  it('login with empty username/password still validates (schema allows empty strings)', () => {
    const raw = bundle([
      {
        data: {
          type: 'login',
          metadata: { name: 'X' },
          content: { itemUsername: '', password: '', urls: [] },
        },
      },
    ]);
    const { items } = parse(raw);
    expect(items[0]).toMatchObject({ type: 'login', username: '', password: '' });
  });

  it('creditCard with MM/YY style expiration', () => {
    const raw = bundle([
      {
        data: {
          type: 'creditCard',
          metadata: { name: 'X' },
          content: {
            cardholderName: 'A',
            number: '4111',
            expirationDate: '03/2030',
          },
        },
      },
    ]);
    const { items } = parse(raw);
    expect(items[0]).toMatchObject({ expMonth: '03', expYear: '2030' });
  });

  it('creditCard with unrecognised expiration → empty fields', () => {
    const raw = bundle([
      {
        data: {
          type: 'creditCard',
          metadata: { name: 'X' },
          content: { cardholderName: 'A', number: '4111', expirationDate: 'NEVER' },
        },
      },
    ]);
    const { items } = parse(raw);
    expect(items[0]).toMatchObject({ expMonth: '', expYear: '' });
  });

  it('throws when top-level data is not an object', () => {
    expect(() => parse('null')).toThrow();
    expect(() => parse('[]')).toThrow();
  });

  it('handles extraFields as customFields on login', () => {
    const raw = bundle([
      {
        data: {
          type: 'login',
          metadata: { name: 'Site' },
          content: { itemUsername: 'u', password: 'p', urls: [] },
          extraFields: [{ fieldName: 'security question', data: { content: 'maiden name' } }],
        },
      },
    ]);
    const { items } = parse(raw);
    expect((items[0] as { customFields?: unknown }).customFields).toEqual([
      { label: 'security question', value: 'maiden name' },
    ]);
  });

  it('iterates across multiple vaults', () => {
    const raw = JSON.stringify({
      vaults: {
        v1: {
          items: [{ data: { type: 'note', metadata: { name: 'A', note: 'x' }, content: {} } }],
        },
        v2: {
          items: [{ data: { type: 'note', metadata: { name: 'B', note: 'y' }, content: {} } }],
        },
      },
    });
    const { items } = parse(raw);
    expect(items).toHaveLength(2);
    expect(items.map((i) => i.title)).toEqual(['A', 'B']);
  });
});
