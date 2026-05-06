import { describe, it, expect } from 'vitest';
import type { VaultItem } from '../item/schema.js';
import {
  exportVaultPlaintext,
  exportVaultEncrypted,
  importVaultPlaintext,
  importVaultEncrypted,
} from './index.js';
import { ExportError } from '../errors.js';

const fixtures: VaultItem[] = [
  {
    type: 'login',
    title: 'GitHub',
    username: 'user@example.com',
    password: 's3cr3t',
    url: 'https://github.com',
    notes: 'main account',
  },
  {
    type: 'secure_note',
    title: 'SSH Key',
    content: 'ssh-rsa AAAAB3NzaC1yc2EAAAA',
  },
  {
    type: 'payment_card',
    title: 'Visa',
    cardholderName: 'John Doe',
    number: '4111111111111111',
    expMonth: '12',
    expYear: '2028',
    cvv: '123',
  },
  {
    type: 'identity',
    title: 'Personal',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john@example.com',
    phone: '+1234567890',
  },
  {
    type: 'totp',
    title: 'GitHub 2FA',
    secret: 'BASE32SECRET',
    issuer: 'GitHub',
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
  },
  {
    type: 'developer_credential',
    title: 'OpenAI prod key',
    provider: 'OpenAI',
    credentialMode: 'token',
    secret: 'sk-secret',
    keyId: 'primary',
    environment: 'production',
    baseUrl: 'https://api.openai.com/v1',
  },
  {
    type: 'developer_credential',
    title: 'Billing staging client',
    provider: 'Billing API',
    credentialMode: 'client_secret_pair',
    clientId: 'billing-web',
    clientSecret: 'super-secret',
    environment: 'staging',
  },
  {
    type: 'developer_credential',
    title: 'SSH deploy key',
    credentialMode: 'ssh_key',
    privateKey: '-----BEGIN OPENSSH PRIVATE KEY-----\nabc\n-----END OPENSSH PRIVATE KEY-----',
    publicKey: 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIexample deploy@host',
    username: 'deploy',
    host: 'bastion.example.com',
    algorithm: 'ed25519',
    fingerprint: 'SHA256:abc123',
    passphrase: 'ssh-passphrase',
    notes: 'deploy access',
  },
];

describe('exportVaultPlaintext / importVaultPlaintext', () => {
  it('round-trips all item types', async () => {
    const json = await exportVaultPlaintext(fixtures);
    const result = await importVaultPlaintext(json);
    expect(result).toEqual(fixtures);
  });

  it('produces correct envelope fields', async () => {
    const json = await exportVaultPlaintext(fixtures);
    const parsed = JSON.parse(json);
    expect(parsed.type).toBe('blindpass-export');
    expect(parsed.version).toBe(1);
    expect(typeof parsed.exportedAt).toBe('string');
    expect(parsed.items).toHaveLength(fixtures.length);
  });

  it('handles empty vault', async () => {
    const json = await exportVaultPlaintext([]);
    const result = await importVaultPlaintext(json);
    expect(result).toEqual([]);
  });
});

describe('exportVaultEncrypted / importVaultEncrypted', () => {
  it('round-trips all item types with correct passphrase', async () => {
    const json = await exportVaultEncrypted(fixtures, 'test-passphrase-123');
    const result = await importVaultEncrypted(json, 'test-passphrase-123');
    expect(result).toEqual(fixtures);
  });

  it('throws on wrong passphrase', async () => {
    const json = await exportVaultEncrypted(fixtures, 'correct-passphrase');
    await expect(importVaultEncrypted(json, 'wrong-passphrase')).rejects.toThrow(
      'Incorrect passphrase',
    );
  });

  it('produces correct envelope fields', async () => {
    const json = await exportVaultEncrypted(fixtures, 'passphrase');
    const parsed = JSON.parse(json);
    expect(parsed.type).toBe('blindpass-export-encrypted');
    expect(parsed.version).toBe(1);
    expect(typeof parsed.kekSalt).toBe('string');
    expect(typeof parsed.nonce).toBe('string');
    expect(typeof parsed.ciphertext).toBe('string');
  });

  it('produces different ciphertext each call (random salt)', async () => {
    const a = await exportVaultEncrypted(fixtures, 'passphrase');
    const b = await exportVaultEncrypted(fixtures, 'passphrase');
    expect(JSON.parse(a).ciphertext).not.toBe(JSON.parse(b).ciphertext);
  });
});

describe('importVaultPlaintext error cases', () => {
  it('throws on invalid JSON', async () => {
    await expect(importVaultPlaintext('not json')).rejects.toThrow(
      'Not a valid BlindPass export file',
    );
  });

  it('throws on wrong type field', async () => {
    const json = JSON.stringify({ version: 1, type: 'something-else', items: [] });
    await expect(importVaultPlaintext(json)).rejects.toThrow('Not a valid BlindPass export file');
  });

  it('throws on unsupported version', async () => {
    const json = JSON.stringify({ version: 2, type: 'blindpass-export', items: [] });
    await expect(importVaultPlaintext(json)).rejects.toThrow('Export version not supported');
  });

  it('throws on missing items array', async () => {
    const json = JSON.stringify({ version: 1, type: 'blindpass-export' });
    await expect(importVaultPlaintext(json)).rejects.toThrow('Not a valid BlindPass export file');
  });
});

describe('importVaultPlaintext error cases (extra)', () => {
  it('throws ExportError on invalid item in array', async () => {
    const json = JSON.stringify({
      version: 1,
      type: 'blindpass-export',
      exportedAt: new Date().toISOString(),
      items: [{ type: 'unknown-type', title: 'bad' }],
    });
    await expect(importVaultPlaintext(json)).rejects.toThrow(ExportError);
  });

  it('accepts legacy api_key payloads during import', async () => {
    const json = JSON.stringify({
      version: 1,
      type: 'blindpass-export',
      exportedAt: new Date().toISOString(),
      items: [
        {
          type: 'api_key',
          title: 'Legacy key',
          provider: 'OpenAI',
          credentialMode: 'token',
          secret: 'sk-secret',
        },
      ],
    });

    await expect(importVaultPlaintext(json)).resolves.toEqual([
      {
        type: 'developer_credential',
        title: 'Legacy key',
        provider: 'OpenAI',
        credentialMode: 'token',
        secret: 'sk-secret',
      },
    ]);
  });
});

describe('importVaultEncrypted error cases', () => {
  it('throws on invalid JSON', async () => {
    await expect(importVaultEncrypted('not json', 'pass')).rejects.toThrow(
      'Not a valid BlindPass export file',
    );
  });

  it('throws on wrong type field', async () => {
    const json = JSON.stringify({
      version: 1,
      type: 'blindpass-export',
      kekSalt: '',
      nonce: '',
      ciphertext: '',
    });
    await expect(importVaultEncrypted(json, 'pass')).rejects.toThrow(
      'Not a valid BlindPass export file',
    );
  });

  it('throws on unsupported version', async () => {
    const json = JSON.stringify({
      version: 2,
      type: 'blindpass-export-encrypted',
      kekSalt: 'dGVzdA==',
      nonce: 'dGVzdA==',
      ciphertext: 'dGVzdA==',
    });
    await expect(importVaultEncrypted(json, 'pass')).rejects.toThrow(
      'Export version not supported',
    );
  });

  it('throws on non-string kekSalt', async () => {
    const json = JSON.stringify({
      version: 1,
      type: 'blindpass-export-encrypted',
      kekSalt: 123,
      nonce: 'dGVzdA==',
      ciphertext: 'dGVzdA==',
    });
    await expect(importVaultEncrypted(json, 'pass')).rejects.toThrow(
      'Not a valid BlindPass export file',
    );
  });

  it('throws on invalid base64 in kekSalt', async () => {
    const json = JSON.stringify({
      version: 1,
      type: 'blindpass-export-encrypted',
      kekSalt: 'not!!base64',
      nonce: 'dGVzdA==',
      ciphertext: 'dGVzdA==',
    });
    await expect(importVaultEncrypted(json, 'pass')).rejects.toThrow(
      'Not a valid BlindPass export file',
    );
  });
});
