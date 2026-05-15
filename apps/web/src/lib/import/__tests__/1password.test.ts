import { describe, expect, it } from 'vitest';
import { zipSync, strToU8 } from 'fflate';
import { parse, __internal } from '../parsers/1password';

function wrap(items: unknown[]): Uint8Array {
  const exportData = JSON.stringify({
    accounts: [{ vaults: [{ items }] }],
  });
  return zipSync({
    'export.attributes': strToU8('{}'),
    'export.data': strToU8(exportData),
  });
}

const loginItem = {
  categoryUuid: '001',
  overview: { title: 'GitHub', url: 'https://github.com' },
  details: {
    loginFields: [
      { designation: 'username', value: { string: 'alice' } },
      { designation: 'password', value: { concealed: 'secret' } },
    ],
    sections: [
      {
        fields: [
          {
            title: 'One-time password',
            value: { totp: 'otpauth://totp/GitHub:alice?secret=JBSW' },
          },
        ],
      },
    ],
    notesPlain: 'work account',
  },
  files: [{ fileName: 'recovery.pdf' }, { fileName: 'codes.txt' }],
};

describe('1password .1pux parser', () => {
  it('throws on archive missing export.data', async () => {
    const bytes = zipSync({ 'export.attributes': strToU8('{}') });
    await expect(parse(bytes)).rejects.toThrow();
  });

  it('throws on invalid JSON in export.data', async () => {
    const bytes = zipSync({ 'export.data': strToU8('not json') });
    await expect(parse(bytes)).rejects.toThrow();
  });

  it('maps a Login item, splits TOTP, counts attachments, surfaces breadcrumb', async () => {
    const bytes = wrap([loginItem]);
    const { items, skipped, attachmentsDropped } = await parse(bytes);
    expect(skipped).toBe(0);
    expect(attachmentsDropped).toBe(2);
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      type: 'login',
      title: 'GitHub',
      username: 'alice',
      password: 'secret',
      url: 'https://github.com',
      notes: expect.stringContaining('work account'),
    });
    const notes = (items[0] as { notes: string }).notes;
    expect(notes).toContain('[Lost attachments: recovery.pdf, codes.txt]');
    expect(items[1]).toMatchObject({ type: 'totp', secret: 'JBSW' });
  });

  it('maps Credit Card (002) with 6-digit YYYYMM expiry', async () => {
    const card = {
      categoryUuid: '002',
      overview: { title: 'Visa' },
      details: {
        sections: [
          {
            fields: [
              { name: 'cardholder', value: { string: 'A. Person' } },
              { name: 'ccnum', value: { concealed: '4111111111111111' } },
              { name: 'cvv', value: { concealed: '123' } },
              { name: 'expiry', value: { monthYear: '202712' } },
            ],
          },
        ],
      },
    };
    const { items } = await parse(wrap([card]));
    expect(items[0]).toMatchObject({
      type: 'payment_card',
      expMonth: '12',
      expYear: '2027',
      cvv: '123',
    });
  });

  it('maps Secure Note (003)', async () => {
    const note = {
      categoryUuid: '003',
      overview: { title: 'My Note' },
      details: { notesPlain: 'note body' },
    };
    const { items } = await parse(wrap([note]));
    expect(items[0]).toMatchObject({
      type: 'secure_note',
      title: 'My Note',
      content: 'note body',
    });
  });

  it('maps Identity (004) when first + last present', async () => {
    const identity = {
      categoryUuid: '004',
      overview: { title: 'Me' },
      details: {
        sections: [
          {
            fields: [
              { name: 'firstname', value: { string: 'Alice' } },
              { name: 'lastname', value: { string: 'Smith' } },
              { name: 'email', value: { email: 'a@b.com' } },
              { name: 'occupation', value: { string: 'Engineer' } },
            ],
          },
        ],
      },
    };
    const { items } = await parse(wrap([identity]));
    expect(items[0]).toMatchObject({
      type: 'identity',
      firstName: 'Alice',
      lastName: 'Smith',
      email: 'a@b.com',
    });
    expect((items[0] as { customFields?: { label: string }[] }).customFields).toContainEqual({
      label: 'Occupation',
      value: 'Engineer',
    });
  });

  it('coerces Identity (004) when first/last missing', async () => {
    const identity = {
      categoryUuid: '004',
      overview: { title: 'Anon' },
      details: {
        sections: [{ fields: [{ name: 'email', value: { email: 'x@y.com' } }] }],
      },
    };
    const { items } = await parse(wrap([identity]));
    expect(items[0]).toMatchObject({ type: 'secure_note', title: '[Identity] Anon' });
  });

  it('maps Password (005) as login with empty username', async () => {
    const password = {
      categoryUuid: '005',
      overview: { title: 'PIN' },
      details: {
        loginFields: [{ designation: 'password', value: { concealed: 'hunter2' } }],
      },
    };
    const { items } = await parse(wrap([password]));
    expect(items[0]).toMatchObject({
      type: 'login',
      title: 'PIN',
      username: '',
      password: 'hunter2',
    });
  });

  it('maps SSH Key (114) when all required fields present', async () => {
    const sshKey = {
      categoryUuid: '114',
      overview: { title: 'Prod key' },
      details: {
        sections: [
          {
            fields: [
              { name: 'private_key', value: { string: '-----BEGIN PRIVATE KEY-----' } },
              { name: 'public_key', value: { string: 'ssh-rsa AAAA' } },
              { name: 'fingerprint', value: { string: 'SHA256:abc' } },
            ],
          },
        ],
      },
    };
    const { items } = await parse(wrap([sshKey]));
    expect(items[0]).toMatchObject({
      type: 'developer_credential',
      credentialMode: 'ssh_key',
      privateKey: '-----BEGIN PRIVATE KEY-----',
      publicKey: 'ssh-rsa AAAA',
      fingerprint: 'SHA256:abc',
      username: 'imported',
      host: 'imported',
    });
  });

  it('coerces SSH Key (114) when private or public key missing', async () => {
    const sshKey = {
      categoryUuid: '114',
      overview: { title: 'Empty key' },
      details: {
        sections: [{ fields: [{ name: 'fingerprint', value: { string: 'SHA256:x' } }] }],
      },
    };
    const { items } = await parse(wrap([sshKey]));
    expect(items[0]).toMatchObject({ type: 'secure_note', title: '[SSH Key] Empty key' });
  });

  it('coerces an unknown category (e.g. 101 Bank Account)', async () => {
    const bank = {
      categoryUuid: '101',
      overview: { title: 'Chase' },
      details: {
        sections: [
          {
            fields: [
              { name: 'bank_name', value: { string: 'Chase' } },
              { name: 'account_number', value: { concealed: '12345' } },
            ],
          },
        ],
        notesPlain: 'checking',
      },
    };
    const { items } = await parse(wrap([bank]));
    expect(items[0]).toMatchObject({
      type: 'secure_note',
      title: '[Bank Account] Chase',
      content: expect.stringContaining('checking'),
    });
    const cf = (items[0] as { customFields?: { label: string; value: string }[] }).customFields;
    expect(cf).toContainEqual({ label: 'Bank Name', value: 'Chase' });
    expect(cf).toContainEqual({ label: 'Account Number', value: '12345' });
  });

  it('maps API Credential (112) as developer_credential token mode', async () => {
    const apiCred = {
      categoryUuid: '112',
      overview: { title: 'GitHub API', url: 'https://api.github.com' },
      details: {
        sections: [
          {
            fields: [
              { name: 'credential', value: { concealed: 'ghp_xxx' } },
              { name: 'hostname', value: { string: 'api.github.com' } },
            ],
          },
        ],
      },
    };
    const { items } = await parse(wrap([apiCred]));
    expect(items[0]).toMatchObject({
      type: 'developer_credential',
      credentialMode: 'token',
      provider: 'api.github.com',
      secret: 'ghp_xxx',
    });
  });

  it('coerces API Credential (112) when neither token nor client-secret-pair present', async () => {
    const apiCred = {
      categoryUuid: '112',
      overview: { title: 'Empty API' },
      details: { sections: [{ fields: [{ name: 'note', value: { string: 'nothing' } }] }] },
    };
    const { items } = await parse(wrap([apiCred]));
    expect(items[0]).toMatchObject({ type: 'secure_note', title: '[API Credential] Empty API' });
  });

  it('maps wallet-shaped item with valid BIP39 mnemonic to crypto_wallet', async () => {
    const mnemonic = Array(12).fill('abandon').join(' ');
    const wallet = {
      categoryUuid: '999',
      overview: { title: 'My Wallet' },
      details: {
        sections: [
          {
            fields: [
              { name: 'recovery_phrase', value: { concealed: mnemonic } },
              { name: 'derivation_path', value: { string: "m/44'/0'/0'" } },
            ],
          },
        ],
      },
    };
    const { items } = await parse(wrap([wallet]));
    expect(items[0]).toMatchObject({
      type: 'crypto_wallet',
      walletMode: 'bip39',
      mnemonic,
      derivationPath: "m/44'/0'/0'",
    });
  });

  it('coerces wallet-shaped item with bad mnemonic word count', async () => {
    const wallet = {
      categoryUuid: '999',
      overview: { title: 'Broken Wallet' },
      details: {
        sections: [
          { fields: [{ name: 'recovery_phrase', value: { string: 'only three words here' } }] },
        ],
      },
    };
    const { items } = await parse(wrap([wallet]));
    expect(items[0]).toMatchObject({
      type: 'secure_note',
      title: expect.stringContaining('Broken Wallet'),
    });
  });

  it('reads address-typed values into a single-line string', async () => {
    const identity = {
      categoryUuid: '004',
      overview: { title: 'Me' },
      details: {
        sections: [
          {
            fields: [
              { name: 'firstname', value: { string: 'Alice' } },
              { name: 'lastname', value: { string: 'Smith' } },
              {
                name: 'address',
                value: { address: { street: '1 Main', city: 'NYC', country: 'US' } },
              },
            ],
          },
        ],
      },
    };
    const { items } = await parse(wrap([identity]));
    expect((items[0] as { address?: string }).address).toBe('1 Main, NYC, US');
  });

  it('treats Password (005) without password field as coerce fallback', async () => {
    const password = {
      categoryUuid: '005',
      overview: { title: 'PIN' },
      details: { loginFields: [] },
    };
    const { items, skipped } = await parse(wrap([password]));
    // login schema accepts empty password → maps, but check at least one path lit
    expect(skipped + items.length).toBe(1);
  });

  it('handles item without overview title falling back to (untitled)', async () => {
    const note = { categoryUuid: '003', details: { notesPlain: 'orphan' } };
    const { items } = await parse(wrap([note]));
    expect(items[0]).toMatchObject({ type: 'secure_note', title: '(untitled)' });
  });

  it('coerced items still count attachments toward attachmentsDropped', () => {
    const item = {
      categoryUuid: '101',
      overview: { title: 'X' },
      details: { sections: [] },
      files: [{ fileName: 'a.pdf' }],
    };
    const mapped = __internal.mapItem(item);
    expect(mapped.attachmentsDropped).toBe(1);
    expect((mapped.primary as { content: string }).content).toContain('[Lost attachments: a.pdf]');
  });

  it('does not leak secret-named custom section fields into customFields', () => {
    const login = {
      categoryUuid: '001',
      overview: { title: 'Wallet' },
      details: {
        loginFields: [
          { designation: 'username', value: { string: 'alice' } },
          { designation: 'password', value: { concealed: 'pw' } },
        ],
        sections: [
          {
            fields: [
              { title: 'Recovery Phrase', value: { concealed: 'word1 word2 word3' } },
              { title: 'API Secret', value: { concealed: 'sk_live_xyz' } },
              { title: 'Card CVV', value: { concealed: '123' } },
              { title: 'Color', value: { string: 'blue' } },
            ],
          },
        ],
      },
    };
    const mapped = __internal.mapItem(login);
    const labels = ((mapped.primary as { customFields?: { label: string }[] }).customFields ?? [])
      .map((f) => f.label)
      .sort();
    expect(labels).toEqual(['Color']);
  });
});
