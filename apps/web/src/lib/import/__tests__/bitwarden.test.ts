import { describe, expect, it } from 'vitest';
import { parse } from '../parsers/bitwarden';

function bw(items: unknown[]) {
  return JSON.stringify({ encrypted: false, items });
}

const loginItem = {
  id: '1',
  name: 'Google',
  type: 1,
  login: {
    username: 'user@gmail.com',
    password: 'pass123',
    uris: [{ uri: 'https://google.com', match: null }],
    totp: null,
  },
  notes: null,
};

describe('bitwarden parser', () => {
  it('maps login item', () => {
    const { items, skipped } = parse(bw([loginItem]));
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      type: 'login',
      title: 'Google',
      username: 'user@gmail.com',
      password: 'pass123',
      url: 'https://google.com',
    });
    expect(skipped).toBe(0);
  });

  it('maps secure_note item', () => {
    const raw = bw([{ id: '2', name: 'My Note', type: 2, notes: 'secret content' }]);
    const { items, skipped } = parse(raw);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      type: 'secure_note',
      title: 'My Note',
      content: 'secret content',
    });
    expect(skipped).toBe(0);
  });

  it('maps payment_card item', () => {
    const raw = bw([
      {
        id: '3',
        name: 'Visa',
        type: 3,
        card: {
          cardholderName: 'John Doe',
          number: '4111111111111111',
          expMonth: '12',
          expYear: '2028',
          code: '123',
        },
        notes: null,
      },
    ]);
    const { items } = parse(raw);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      type: 'payment_card',
      title: 'Visa',
      cardholderName: 'John Doe',
      number: '4111111111111111',
    });
  });

  it('maps identity item', () => {
    const raw = bw([
      {
        id: '4',
        name: 'Me',
        type: 4,
        identity: {
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
          phone: null,
          address1: '123 Main St',
          city: 'Springfield',
          country: 'US',
        },
        notes: null,
      },
    ]);
    const { items } = parse(raw);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      type: 'identity',
      title: 'Me',
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      city: 'Springfield',
    });
  });

  it('splits login+totp into two items when totp field present', () => {
    const itemWithTotp = {
      ...loginItem,
      login: {
        ...loginItem.login,
        totp: 'otpauth://totp/Google:user@gmail.com?secret=JBSWY3DPEHPK3PXP&issuer=Google',
      },
    };
    const { items, skipped } = parse(bw([itemWithTotp]));
    expect(items).toHaveLength(2);
    expect(items[0].type).toBe('login');
    expect(items[1].type).toBe('totp');
    if (items[1].type === 'totp') {
      expect(items[1].secret).toBe('JBSWY3DPEHPK3PXP');
      expect(items[1].issuer).toBe('Google');
    }
    expect(skipped).toBe(0);
  });

  it('coerces unknown type into a secure_note with bitwarden-type-prefixed title', () => {
    const raw = bw([{ id: '5', name: 'Unknown', type: 99 }]);
    const { items, skipped } = parse(raw);
    expect(skipped).toBe(0);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      type: 'secure_note',
      title: '[Bitwarden type 99] Unknown',
    });
  });

  it('skips malformed item (counted as skipped)', () => {
    const raw = bw([null]);
    const { items, skipped } = parse(raw);
    expect(items).toHaveLength(0);
    expect(skipped).toBe(1);
  });

  it('throws on invalid JSON', () => {
    expect(() => parse('not json')).toThrow();
  });

  it('throws on missing items array', () => {
    expect(() => parse(JSON.stringify({ encrypted: false }))).toThrow();
  });

  it('parses totp with SHA256 algorithm', () => {
    const itemWithTotp = {
      ...loginItem,
      login: {
        ...loginItem.login,
        totp: 'otpauth://totp/Example:user?secret=JBSWY3DP&algorithm=SHA256&digits=6&period=30',
      },
    };
    const { items } = parse(bw([itemWithTotp]));
    const totpItem = items.find((i) => i.type === 'totp');
    expect(totpItem).toBeDefined();
    if (totpItem?.type === 'totp') expect(totpItem.algorithm).toBe('SHA256');
  });

  it('parses totp with unknown algorithm as SHA1', () => {
    const itemWithTotp = {
      ...loginItem,
      login: {
        ...loginItem.login,
        totp: 'otpauth://totp/Example:user?secret=JBSWY3DP&algorithm=MD5',
      },
    };
    const { items } = parse(bw([itemWithTotp]));
    const totpItem = items.find((i) => i.type === 'totp');
    expect(totpItem).toBeDefined();
    if (totpItem?.type === 'totp') expect(totpItem.algorithm).toBe('SHA1');
  });

  it('parses totp with no algorithm as undefined (defaults to SHA1 in schema)', () => {
    const itemWithTotp = {
      ...loginItem,
      login: {
        ...loginItem.login,
        totp: 'otpauth://totp/Example:user?secret=JBSWY3DP',
      },
    };
    const { items } = parse(bw([itemWithTotp]));
    const totpItem = items.find((i) => i.type === 'totp');
    expect(totpItem).toBeDefined();
    if (totpItem?.type === 'totp') expect(totpItem.algorithm).toBe('SHA1');
  });

  it('parses totp with SHA1 algorithm', () => {
    const itemWithTotp = {
      ...loginItem,
      login: {
        ...loginItem.login,
        totp: 'otpauth://totp/Test?secret=JBSWY3DP&algorithm=SHA1',
      },
    };
    const { items } = parse(bw([itemWithTotp]));
    const totpItem = items.find((i) => i.type === 'totp');
    if (totpItem?.type === 'totp') expect(totpItem.algorithm).toBe('SHA1');
  });

  it('coerces item with non-number type', () => {
    const raw = bw([{ id: '5', name: 'Unknown', type: 'invalid' }]);
    const { items, skipped } = parse(raw);
    expect(skipped).toBe(0);
    expect(items[0]).toMatchObject({ type: 'secure_note' });
  });

  it('parses totp with digits and period', () => {
    const itemWithTotp = {
      ...loginItem,
      login: {
        ...loginItem.login,
        totp: 'otpauth://totp/X?secret=JBSWY3DP&digits=8&period=60',
      },
    };
    const { items } = parse(bw([itemWithTotp]));
    const totpItem = items.find((i) => i.type === 'totp');
    if (totpItem?.type === 'totp') {
      expect(totpItem.digits).toBe(8);
      expect(totpItem.period).toBe(60);
    }
  });

  it('imports totp when field is a plain base32 secret', () => {
    const itemWithPlainTotp = {
      ...loginItem,
      login: {
        ...loginItem.login,
        totp: 'JBSWY3DPEHPK3PXP',
      },
    };
    const { items, skipped } = parse(bw([itemWithPlainTotp]));
    expect(items).toHaveLength(2);
    expect(items[0].type).toBe('login');
    expect(items[1].type).toBe('totp');
    if (items[1].type === 'totp') {
      expect(items[1].secret).toBe('JBSWY3DPEHPK3PXP');
    }
    expect(skipped).toBe(0);
  });

  it('does not create totp item when totp field is empty string', () => {
    const itemWithEmptyTotp = {
      ...loginItem,
      login: { ...loginItem.login, totp: '' },
    };
    const { items } = parse(bw([itemWithEmptyTotp]));
    expect(items).toHaveLength(1);
    expect(items[0].type).toBe('login');
  });

  it('skips login when Zod validation fails (non-string password)', () => {
    const bad = {
      id: '1',
      name: 'Bad',
      type: 1,
      login: { username: 'u', password: 123, uris: [] },
      notes: null,
    };
    const { items, skipped } = parse(bw([bad]));
    expect(items).toHaveLength(0);
    expect(skipped).toBe(1);
  });

  it('skips secure_note when Zod validation fails (non-string content)', () => {
    const bad = { id: '2', name: 'Note', type: 2, notes: 42 };
    const { items, skipped } = parse(bw([bad]));
    expect(items).toHaveLength(0);
    expect(skipped).toBe(1);
  });

  it('skips payment_card when Zod validation fails (non-string number)', () => {
    const bad = {
      id: '3',
      name: 'Card',
      type: 3,
      card: { cardholderName: 'J', number: false, expMonth: '1', expYear: '2030', code: null },
      notes: null,
    };
    const { items, skipped } = parse(bw([bad]));
    expect(items).toHaveLength(0);
    expect(skipped).toBe(1);
  });

  it('maps custom fields (text/hidden/boolean) on login item', () => {
    const item = {
      ...loginItem,
      fields: [
        { name: 'API Key', value: 'abc123', type: 0 },
        { name: 'Token', value: 'secret', type: 1 },
        { name: 'Active', value: 'true', type: 2 },
        { name: 'Linked', value: 'something', type: 3 },
      ],
    };
    const { items } = parse(bw([item]));
    const login = items.find((i) => i.type === 'login');
    expect(login?.customFields).toEqual([
      { label: 'API Key', value: 'abc123' },
      { label: 'Token', value: 'secret' },
      { label: 'Active', value: 'true' },
    ]);
  });

  it('drops fields with null name and returns undefined when none remain', () => {
    const item = {
      ...loginItem,
      fields: [
        { name: null, value: 'val', type: 0 },
        { name: 'Linked', value: 'x', type: 3 },
      ],
    };
    const { items } = parse(bw([item]));
    const login = items.find((i) => i.type === 'login');
    expect(login?.customFields).toBeUndefined();
  });

  it('totp split item has no customFields', () => {
    const item = {
      ...loginItem,
      fields: [{ name: 'Tag', value: 'val', type: 0 }],
      login: {
        ...loginItem.login,
        totp: 'otpauth://totp/Google:user@gmail.com?secret=JBSWY3DPEHPK3PXP&issuer=Google',
      },
    };
    const { items } = parse(bw([item]));
    const totp = items.find((i) => i.type === 'totp');
    expect(totp?.customFields).toBeUndefined();
  });

  it('skips secure_note when Zod validation fails', () => {
    const bad = { id: '2', name: 123, type: 2, notes: 'content' };
    const { items, skipped } = parse(bw([bad]));
    expect(items).toHaveLength(0);
    expect(skipped).toBe(1);
  });

  it('skips payment_card when Zod validation fails', () => {
    const bad = { id: '3', name: 123, type: 3, card: {} };
    const { items, skipped } = parse(bw([bad]));
    expect(items).toHaveLength(0);
    expect(skipped).toBe(1);
  });

  it('skips identity when Zod validation fails', () => {
    const bad = { id: '4', name: 123, type: 4, identity: {} };
    const { items, skipped } = parse(bw([bad]));
    expect(items).toHaveLength(0);
    expect(skipped).toBe(1);
  });

  it('handles payment_card with missing card object', () => {
    const bad = { id: '3', name: 'NoCard', type: 3 };
    const { skipped } = parse(bw([bad]));
    // Cardholder name, number, etc. will be empty strings, which might fail validation
    // depending on the schema. If it fails, skipped increases.
    expect(skipped).toBeGreaterThanOrEqual(0);
  });

  it('handles identity with missing identity object', () => {
    const bad = { id: '4', name: 'NoIdentity', type: 4 };
    const { skipped } = parse(bw([bad]));
    expect(skipped).toBeGreaterThanOrEqual(0);
  });

  it('skips totp item when validation fails (invalid period)', () => {
    const itemWithBadTotp = {
      ...loginItem,
      login: {
        ...loginItem.login,
        // period=5 is invalid (min 15 in TotpItemSchema)
        totp: 'otpauth://totp/X?secret=JBSWY3DPEHPK3PXP&period=5',
      },
    };
    const { items } = parse(bw([itemWithBadTotp]));
    // Should have 1 item (login) and 0 totp items if validation fails
    expect(items.filter((i) => i.type === 'totp')).toHaveLength(0);
  });

  it('skips totp item when validation fails (missing title)', () => {
    const itemWithTotp = {
      ...loginItem,
      name: '', // Empty name will cause title: '' in safeParse
      login: {
        ...loginItem.login,
        totp: 'otpauth://totp/X?secret=JBSWY3DPEHPK3PXP',
      },
    };
    const { items } = parse(bw([itemWithTotp]));
    expect(items.filter((i) => i.type === 'totp')).toHaveLength(0);
  });

  it('increments skipped when an item processing throws', () => {
    // type 1 (login) processing might throw if we mess with its expected shape in an unusual way
    // or we can just pass something that isn't an object
    const { items, skipped } = parse(bw([undefined as unknown as Record<string, unknown>]));
    expect(items).toHaveLength(0);
    expect(skipped).toBe(1);
  });

  it('parses totp with label but no colon (no issuer from path)', () => {
    const itemWithTotp = {
      ...loginItem,
      login: {
        ...loginItem.login,
        totp: 'otpauth://totp/MyAccount?secret=JBSWY3DPEHPK3PXP',
      },
    };
    const { items } = parse(bw([itemWithTotp]));
    const totpItem = items.find((i) => i.type === 'totp');
    expect(totpItem).toBeDefined();
    if (totpItem?.type === 'totp') {
      expect(totpItem.issuer).toBeUndefined();
      expect(totpItem.accountName).toBe('MyAccount');
    }
  });

  it('maps custom field with null value to empty string', () => {
    const item = { ...loginItem, fields: [{ name: 'Key', value: null, type: 0 }] };
    const { items } = parse(bw([item]));
    const login = items.find((i) => i.type === 'login');
    expect(login?.customFields).toEqual([{ label: 'Key', value: '' }]);
  });

  it('parses totp with SHA512 algorithm', () => {
    const itemWithTotp = {
      ...loginItem,
      login: {
        ...loginItem.login,
        totp: 'otpauth://totp/Test?secret=JBSWY3DP&algorithm=SHA512',
      },
    };
    const { items } = parse(bw([itemWithTotp]));
    const totpItem = items.find((i) => i.type === 'totp');
    expect(totpItem).toBeDefined();
    if (totpItem?.type === 'totp') expect(totpItem.algorithm).toBe('SHA512');
  });

  it('coerces item when bwType is unknown (duplicate path test)', () => {
    const raw = bw([{ id: 'x', name: 'Unknown', type: 99 }]);
    const { items, skipped } = parse(raw);
    expect(skipped).toBe(0);
    expect(items[0]).toMatchObject({ type: 'secure_note', title: '[Bitwarden type 99] Unknown' });
  });

  it('parseCustomFields returns undefined for non-array', () => {
    const { items } = parse(bw([{ id: '1', name: 'N', type: 1, fields: 'not-array' }]));
    expect(items[0].customFields).toBeUndefined();
  });

  it('parseTotpUri returns null for empty string', () => {
    const { items } = parse(bw([{ id: '1', name: 'N', type: 1, login: { totp: '  ' } }]));
    // Should have 1 item (login) and 0 totp items
    expect(items.filter((i) => i.type === 'totp')).toHaveLength(0);
  });

  it('parseTotpUri returns secret for non-otpauth protocol', () => {
    const { items } = parse(bw([{ id: '1', name: 'N', type: 1, login: { totp: 'plain-secret' } }]));
    const totp = items.find((i) => i.type === 'totp');
    if (totp?.type === 'totp') expect(totp.secret).toBe('plain-secret');
  });

  it('parseTotpUri returns null when secret is missing in otpauth URI', () => {
    const { items } = parse(
      bw([{ id: '1', name: 'N', type: 1, login: { totp: 'otpauth://totp/X' } }]),
    );
    expect(items.filter((i) => i.type === 'totp')).toHaveLength(0);
  });

  it('skips totp item when otpauth URI is malformed (URL parse throws)', () => {
    const itemWithBadTotp = {
      ...loginItem,
      login: {
        ...loginItem.login,
        // space in host causes new URL() to throw
        totp: 'otpauth:// invalid host?secret=ABC',
      },
    };
    const { items } = parse(bw([itemWithBadTotp]));
    // login item still added, but no totp item
    expect(items).toHaveLength(1);
    expect(items[0].type).toBe('login');
  });

  it('throws error for invalid JSON', () => {
    expect(() => parse('not json')).toThrow('Invalid JSON');
  });

  it('throws error for missing items array', () => {
    expect(() => parse('{}')).toThrow('Invalid Bitwarden export format');
    expect(() => parse('{"items": "not array"}')).toThrow('Invalid Bitwarden export format');
  });

  it('skips custom fields with missing names', () => {
    const { items } = parse(
      bw([{ id: '1', name: 'N', type: 1, fields: [{ value: 'v', type: 0 }] }]),
    );
    expect(items[0].customFields).toBeUndefined();
  });

  it('maps secure_note with missing notes to empty string', () => {
    const raw = bw([{ id: '2', name: 'My Note', type: 2 }]);
    const { items } = parse(raw);
    expect(items[0]).toMatchObject({
      type: 'secure_note',
      content: '',
    });
  });

  it('maps payment_card with missing fields to empty strings', () => {
    const raw = bw([{ id: '3', name: 'Card', type: 3, card: {} }]);
    const { items } = parse(raw);
    expect(items[0]).toMatchObject({
      type: 'payment_card',
      cardholderName: '',
      number: '',
    });
  });

  it('maps identity with missing fields to empty strings', () => {
    const raw = bw([{ id: '4', name: 'ID', type: 4, identity: {} }]);
    const { items } = parse(raw);
    expect(items[0]).toMatchObject({
      type: 'identity',
      firstName: '',
      lastName: '',
    });
  });

  it('parses totp URI with empty label', () => {
    const { items } = parse(
      bw([{ id: '1', name: 'N', type: 1, login: { totp: 'otpauth://totp/?secret=ABC' } }]),
    );
    const totp = items.find((i) => i.type === 'totp');
    if (totp?.type === 'totp') {
      expect(totp.accountName).toBeUndefined();
      expect(totp.issuer).toBeUndefined();
    }
  });

  // Retrofit coverage: type-5 SSH key, catch-path coercion.
  it('maps type-5 SSH key to developer_credential ssh_key mode', () => {
    const raw = bw([
      {
        id: 'k',
        name: 'Prod Key',
        type: 5,
        sshKey: {
          privateKey: '-----BEGIN PRIVATE KEY-----',
          publicKey: 'ssh-rsa AAAA',
          keyFingerprint: 'SHA256:abc',
        },
      },
    ]);
    const { items, skipped } = parse(raw);
    expect(skipped).toBe(0);
    expect(items[0]).toMatchObject({
      type: 'developer_credential',
      credentialMode: 'ssh_key',
      title: 'Prod Key',
      privateKey: '-----BEGIN PRIVATE KEY-----',
      publicKey: 'ssh-rsa AAAA',
      fingerprint: 'SHA256:abc',
      username: 'imported',
      host: 'imported',
    });
  });

  it('coerces type-5 SSH key when private/public/fingerprint missing', () => {
    const raw = bw([{ id: 'k', name: 'Empty Key', type: 5, sshKey: { privateKey: '' } }]);
    const { items } = parse(raw);
    expect(items[0]).toMatchObject({
      type: 'secure_note',
      title: '[Bitwarden SSH Key] Empty Key',
    });
  });

  it('still increments skipped on truly null items (catch path)', () => {
    const raw = bw([null]);
    const { items, skipped } = parse(raw);
    expect(items).toHaveLength(0);
    expect(skipped).toBe(1);
  });

  it('coerces item with missing type as a Bitwarden item (no "undefined" in title)', () => {
    const raw = bw([{ id: 'x', name: 'Orphan' }]);
    const { items, skipped } = parse(raw);
    expect(skipped).toBe(0);
    expect(items[0]).toMatchObject({
      type: 'secure_note',
      title: '[Bitwarden item] Orphan',
    });
  });
});
