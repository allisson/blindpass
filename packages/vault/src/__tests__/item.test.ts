import { describe, it, expect } from 'vitest';
import { generateItemKey } from '@blindpass/crypto';
import {
  encryptVaultItem,
  decryptVaultItem,
  type LoginItem,
  type SecureNote,
  type PaymentCard,
  type Identity,
  type TotpItem,
  type DeveloperCredentialItem,
} from '../index.js';
import {
  CryptoWalletItemSchema,
  DeveloperCredentialItemSchema,
  VaultItemSchema,
} from '../item/schema.js';

describe('LoginItem encrypt/decrypt', () => {
  it('round-trips all fields', async () => {
    const itemKey = await generateItemKey();
    const item: LoginItem = {
      type: 'login',
      title: 'GitHub',
      username: 'user@example.com',
      password: 's3cr3t',
      url: 'https://github.com',
      notes: 'personal account',
    };
    const blob = await encryptVaultItem(item, itemKey);
    const decrypted = await decryptVaultItem(blob, itemKey);
    expect(decrypted).toEqual(item);
  });

  it('round-trips without optional fields', async () => {
    const itemKey = await generateItemKey();
    const item: LoginItem = { type: 'login', title: 'Site', username: 'u', password: 'p' };
    const blob = await encryptVaultItem(item, itemKey);
    const decrypted = await decryptVaultItem(blob, itemKey);
    expect(decrypted).toEqual(item);
  });

  it('throws on wrong key', async () => {
    const itemKey = await generateItemKey();
    const wrongKey = await generateItemKey();
    const item: LoginItem = { type: 'login', title: 'Test', username: 'u', password: 'p' };
    const blob = await encryptVaultItem(item, itemKey);
    await expect(decryptVaultItem(blob, wrongKey)).rejects.toThrow();
  });

  it('lazy migration: missing type field defaults to login', async () => {
    const itemKey = await generateItemKey();
    const raw = { title: 'Old', username: 'u', password: 'p' };
    const plaintext = new TextEncoder().encode(JSON.stringify(raw));
    const { encryptSymmetric } = await import('@blindpass/crypto');
    const blob = await encryptSymmetric(plaintext, itemKey);
    const decrypted = await decryptVaultItem(blob, itemKey);
    expect(decrypted.type).toBe('login');
  });
});

describe('SecureNote encrypt/decrypt', () => {
  it('round-trips all fields', async () => {
    const itemKey = await generateItemKey();
    const item: SecureNote = {
      type: 'secure_note',
      title: 'My Note',
      content: 'This is a secret note.',
      customFields: [{ label: 'Tag', value: 'work' }],
    };
    const blob = await encryptVaultItem(item, itemKey);
    const decrypted = await decryptVaultItem(blob, itemKey);
    expect(decrypted).toEqual(item);
  });
});

describe('PaymentCard encrypt/decrypt', () => {
  it('round-trips all fields', async () => {
    const itemKey = await generateItemKey();
    const item: PaymentCard = {
      type: 'payment_card',
      title: 'Visa',
      cardholderName: 'Jane Doe',
      number: '4111111111111111',
      expMonth: '12',
      expYear: '2027',
      cvv: '123',
      notes: 'main card',
    };
    const blob = await encryptVaultItem(item, itemKey);
    const decrypted = await decryptVaultItem(blob, itemKey);
    expect(decrypted).toEqual(item);
  });
});

describe('Identity encrypt/decrypt', () => {
  it('round-trips all fields', async () => {
    const itemKey = await generateItemKey();
    const item: Identity = {
      type: 'identity',
      title: 'Personal',
      firstName: 'Jane',
      lastName: 'Doe',
      email: 'jane@example.com',
      phone: '+1 555 000 0000',
      address: '123 Main St',
      city: 'New York',
      country: 'US',
      notes: 'primary identity',
    };
    const blob = await encryptVaultItem(item, itemKey);
    const decrypted = await decryptVaultItem(blob, itemKey);
    expect(decrypted).toEqual(item);
  });
});

describe('TotpItem encrypt/decrypt', () => {
  it('round-trips all fields', async () => {
    const itemKey = await generateItemKey();
    const item: TotpItem = {
      type: 'totp',
      title: 'GitHub 2FA',
      secret: 'JBSWY3DPEHPK3PXP',
      issuer: 'GitHub',
      accountName: 'user@example.com',
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      notes: 'backup codes in safe',
    };
    const blob = await encryptVaultItem(item, itemKey);
    const decrypted = await decryptVaultItem(blob, itemKey);
    expect(decrypted).toEqual(item);
  });

  it('round-trips with minimal fields and applies defaults', async () => {
    const itemKey = await generateItemKey();
    const blob = await encryptVaultItem(
      {
        type: 'totp',
        title: 'Test',
        secret: 'JBSWY3DPEHPK3PXP',
        algorithm: 'SHA1',
        digits: 6,
        period: 30,
      },
      itemKey,
    );
    const decrypted = await decryptVaultItem(blob, itemKey);
    expect(decrypted.type).toBe('totp');
    if (decrypted.type === 'totp') {
      expect(decrypted.algorithm).toBe('SHA1');
      expect(decrypted.digits).toBe(6);
      expect(decrypted.period).toBe(30);
    }
  });
});

describe('DeveloperCredentialItem encrypt/decrypt', () => {
  it('round-trips token mode fields', async () => {
    const itemKey = await generateItemKey();
    const item: DeveloperCredentialItem = {
      type: 'developer_credential',
      title: 'OpenAI prod key',
      provider: 'OpenAI',
      credentialMode: 'token',
      secret: 'sk-secret',
      keyId: 'primary',
      environment: 'production',
      baseUrl: 'https://api.openai.com/v1',
      notes: 'server workload',
      customFields: [{ label: 'Owner', value: 'backend' }],
    };
    const blob = await encryptVaultItem(item, itemKey);
    const decrypted = await decryptVaultItem(blob, itemKey);
    expect(decrypted).toEqual(item);
  });

  it('round-trips client secret pair mode fields', async () => {
    const itemKey = await generateItemKey();
    const item: DeveloperCredentialItem = {
      type: 'developer_credential',
      title: 'Billing API staging client',
      provider: 'Billing API',
      credentialMode: 'client_secret_pair',
      clientId: 'billing-web',
      clientSecret: 'super-secret',
      environment: 'staging',
    };
    const blob = await encryptVaultItem(item, itemKey);
    const decrypted = await decryptVaultItem(blob, itemKey);
    expect(decrypted).toEqual(item);
  });

  it('normalizes blank baseUrl to undefined', () => {
    const parsed = DeveloperCredentialItemSchema.parse({
      type: 'developer_credential',
      title: 'Blank base URL',
      provider: 'OpenAI',
      credentialMode: 'token',
      secret: 'sk-secret',
      baseUrl: '   ',
    });

    expect(parsed.credentialMode).toBe('token');
    if (parsed.credentialMode === 'token') {
      expect(parsed.baseUrl).toBeUndefined();
    }
  });

  it('round-trips ssh key mode fields', async () => {
    const itemKey = await generateItemKey();
    const item: DeveloperCredentialItem = {
      type: 'developer_credential',
      title: 'Prod bastion SSH',
      credentialMode: 'ssh_key',
      privateKey: '-----BEGIN OPENSSH PRIVATE KEY-----\nabc\n-----END OPENSSH PRIVATE KEY-----',
      publicKey: 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIexample user@host',
      passphrase: 'hunter2',
      username: 'deploy',
      host: 'bastion.example.com',
      algorithm: 'ed25519',
      fingerprint: 'SHA256:abc123',
      notes: 'Bastion access',
      customFields: [{ label: 'Team', value: 'platform' }],
    };
    const blob = await encryptVaultItem(item, itemKey);
    const decrypted = await decryptVaultItem(blob, itemKey);
    expect(decrypted).toEqual(item);
  });

  it('accepts ssh key mode when only fingerprint is present and trims blanks', () => {
    const parsed = DeveloperCredentialItemSchema.parse({
      type: 'developer_credential',
      title: 'SSH key',
      credentialMode: 'ssh_key',
      privateKey: '-----BEGIN OPENSSH PRIVATE KEY-----',
      publicKey: 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIexample user@host',
      passphrase: '   ',
      username: 'deploy',
      host: 'bastion.example.com',
      algorithm: '   ',
      fingerprint: 'SHA256:abc123',
    });

    expect(parsed.credentialMode).toBe('ssh_key');
    if (parsed.credentialMode === 'ssh_key') {
      expect(parsed.passphrase).toBeUndefined();
      expect(parsed.algorithm).toBeUndefined();
      expect(parsed.fingerprint).toBe('SHA256:abc123');
    }
  });

  it('rejects ssh key mode when both algorithm and fingerprint are missing', () => {
    const result = DeveloperCredentialItemSchema.safeParse({
      type: 'developer_credential',
      title: 'SSH key',
      credentialMode: 'ssh_key',
      privateKey: '-----BEGIN OPENSSH PRIVATE KEY-----',
      publicKey: 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIexample user@host',
      username: 'deploy',
      host: 'bastion.example.com',
      algorithm: '   ',
      fingerprint: '   ',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe('Algorithm or fingerprint is required');
    }
  });

  it('parses legacy api_key items as developer credentials', () => {
    const parsed = VaultItemSchema.parse({
      type: 'api_key',
      title: 'Legacy API key',
      provider: 'OpenAI',
      credentialMode: 'token',
      secret: 'sk-secret',
    });

    expect(parsed.type).toBe('developer_credential');
  });

  it('parses developer credentials through VaultItemSchema without legacy remap', () => {
    const parsed = VaultItemSchema.parse({
      type: 'developer_credential',
      title: 'Current API key',
      provider: 'OpenAI',
      credentialMode: 'token',
      secret: 'sk-secret',
    });

    expect(parsed.type).toBe('developer_credential');
  });

  it('rejects array payloads before schema discrimination', () => {
    expect(VaultItemSchema.safeParse([]).success).toBe(false);
  });
});

describe('CryptoWalletItemSchema', () => {
  const VALID_12 =
    'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

  it('accepts valid 12-word bip39 wallet', () => {
    const result = CryptoWalletItemSchema.safeParse({
      type: 'crypto_wallet',
      walletMode: 'bip39',
      title: 'Test Wallet',
      mnemonic: VALID_12,
    });
    expect(result.success).toBe(true);
  });

  it('rejects mnemonic with invalid word count', () => {
    const result = CryptoWalletItemSchema.safeParse({
      type: 'crypto_wallet',
      walletMode: 'bip39',
      title: 'Test Wallet',
      mnemonic: 'abandon abandon abandon',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.message.includes('words'));
      expect(issue?.message).toBe('Mnemonic must be 12, 15, 18, 21, or 24 words');
    }
  });

  it('accepts valid derivation path', () => {
    const result = CryptoWalletItemSchema.safeParse({
      type: 'crypto_wallet',
      walletMode: 'bip39',
      title: 'Test Wallet',
      mnemonic: VALID_12,
      derivationPath: "m/44'/0'/0'/0/0",
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid derivation path', () => {
    const result = CryptoWalletItemSchema.safeParse({
      type: 'crypto_wallet',
      walletMode: 'bip39',
      title: 'Test Wallet',
      mnemonic: VALID_12,
      derivationPath: 'bad/path',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.message.includes('derivation'));
      expect(issue?.message).toBe('Invalid derivation path format');
    }
  });

  it('treats empty addressHint as undefined', () => {
    const result = CryptoWalletItemSchema.safeParse({
      type: 'crypto_wallet',
      walletMode: 'bip39',
      title: 'Test Wallet',
      mnemonic: VALID_12,
      addressHint: '',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.addressHint).toBeUndefined();
    }
  });
});

describe('custom fields', () => {
  it('custom fields survive encrypt/decrypt round-trip', async () => {
    const itemKey = await generateItemKey();
    const item: LoginItem = {
      type: 'login',
      title: 'Service',
      username: 'u',
      password: 'p',
      customFields: [
        { label: 'API Key', value: 'abc123' },
        { label: 'Region', value: 'us-east-1' },
      ],
    };
    const blob = await encryptVaultItem(item, itemKey);
    const decrypted = await decryptVaultItem(blob, itemKey);
    expect(decrypted.customFields).toEqual(item.customFields);
  });
});

describe('decryptVaultItem error paths', () => {
  it('throws when decrypted bytes are not valid JSON', async () => {
    const itemKey = await generateItemKey();
    const { encryptSymmetric } = await import('@blindpass/crypto');
    const blob = await encryptSymmetric(new TextEncoder().encode('not json {{{'), itemKey);
    await expect(decryptVaultItem(blob, itemKey)).rejects.toThrow();
  });

  it('throws ZodError when decrypted JSON has unknown type', async () => {
    const itemKey = await generateItemKey();
    const { encryptSymmetric } = await import('@blindpass/crypto');
    const raw = JSON.stringify({ type: 'unknown_type', title: 'Bad' });
    const blob = await encryptSymmetric(new TextEncoder().encode(raw), itemKey);
    await expect(decryptVaultItem(blob, itemKey)).rejects.toThrow();
  });
});
