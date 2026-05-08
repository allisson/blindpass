import { beforeAll, describe, expect, it, vi } from 'vitest';
import { decryptSymmetric, deriveKeyEncryptionKey } from '@blindpass/crypto';
import type { KeysResponse, RegisterRequest } from '@blindpass/api-schema';
import { fromBase64, fromBase64EncryptedValue, toBase64 } from '@/lib/b64';

vi.mock('@/lib/kdfWorker', () => ({
  deriveKEK: (password: string, salt: Uint8Array) =>
    deriveKeyEncryptionKey(password, salt, 2, 65536),
}));

let bootstrap: typeof import('./bootstrap.js').bootstrap;
let unlockWithPassword: typeof import('./unlockWithPassword.js').unlockWithPassword;
let unlockWithRecovery: typeof import('./unlockWithRecovery.js').unlockWithRecovery;
let rekey: typeof import('./rekey.js').rekey;
let decryptKeyPair: typeof import('./decryptKeyPair.js').decryptKeyPair;

beforeAll(async () => {
  ({ bootstrap } = await import('./bootstrap.js'));
  ({ unlockWithPassword } = await import('./unlockWithPassword.js'));
  ({ unlockWithRecovery } = await import('./unlockWithRecovery.js'));
  ({ rekey } = await import('./rekey.js'));
  ({ decryptKeyPair } = await import('./decryptKeyPair.js'));
});

function keysResponseFromBootstrap(body: Omit<RegisterRequest, 'username'>): KeysResponse {
  return {
    kekSalt: body.kekSalt,
    publicKey: body.publicKey,
    encryptedMasterKey: body.encryptedMasterKey,
    encryptedMasterKeyForRecovery: body.encryptedMasterKeyForRecovery,
    encryptedPrivateKey: body.encryptedPrivateKey,
    encryptedRecoveryKey: body.encryptedRecoveryKey,
  };
}

describe('keychain.bootstrap', () => {
  it('produces a valid RegisterRequest body and an in-memory MasterKey + VaultKey', async () => {
    const r = await bootstrap('correct-horse-battery-staple');

    expect(r.masterKey).toHaveLength(32);
    expect(r.vaultKey).toHaveLength(32);
    expect(r.publicKey).toHaveLength(32);
    expect(typeof r.recoveryKey).toBe('string');
    expect(r.recoveryKey.split(/\s+/).length).toBeGreaterThanOrEqual(12);

    expect(r.registerBody.kekSalt).toMatch(/^[A-Za-z0-9+/=]+$/);
    expect(r.registerBody.encryptedMasterKey.ciphertext).toMatch(/^[A-Za-z0-9+/=]+$/);
    expect(r.registerBody.encryptedVaultKey.ciphertext).toMatch(/^[A-Za-z0-9+/=]+$/);
    expect(r.registerBody.encryptedVaultData.ciphertext).toMatch(/^[A-Za-z0-9+/=]+$/);
  });
});

describe('keychain.unlockWithPassword (round-trip)', () => {
  it('returns the same MasterKey that bootstrap produced', async () => {
    const password = 'pw-correct-horse';
    const r = await bootstrap(password);
    const keys = keysResponseFromBootstrap(r.registerBody);

    const unlocked = await unlockWithPassword(password, keys);

    expect(unlocked.masterKey).toEqual(r.masterKey);
    expect(unlocked.keyPair.publicKey).toEqual(r.publicKey);
    expect(unlocked.keyPair.privateKey).toHaveLength(32);
  });

  it('throws on wrong password', async () => {
    const r = await bootstrap('right-pw-horse');
    const keys = keysResponseFromBootstrap(r.registerBody);
    await expect(unlockWithPassword('wrong-pw-horse', keys)).rejects.toBeDefined();
  });
});

describe('keychain.unlockWithRecovery (round-trip)', () => {
  it('returns the same MasterKey using the recovery phrase', async () => {
    const r = await bootstrap('any-pw-here-horse');
    const unlocked = await unlockWithRecovery(r.recoveryKey, {
      publicKey: r.registerBody.publicKey,
      encryptedMasterKeyForRecovery: r.registerBody.encryptedMasterKeyForRecovery,
      encryptedPrivateKey: r.registerBody.encryptedPrivateKey,
    });
    expect(unlocked.masterKey).toEqual(r.masterKey);
    expect(unlocked.keyPair.publicKey).toEqual(r.publicKey);
  });
});

describe('keychain.rekey', () => {
  it('produces a new KEK envelope that decrypts to the same MasterKey', async () => {
    const r = await bootstrap('old-password-horse');
    const re = await rekey(r.masterKey, 'new-password-horse');

    const newKek = await deriveKeyEncryptionKey(
      'new-password-horse',
      fromBase64(re.kekSalt),
      2,
      65536,
    );
    const recoveredMaster = await decryptSymmetric(
      fromBase64EncryptedValue(re.encryptedMasterKey),
      newKek,
    );
    expect(recoveredMaster).toEqual(r.masterKey);

    expect(re.newRecoveryKey).not.toBe(r.recoveryKey);
    expect(re.recoveryVerifier).toBe(toBase64(new TextEncoder().encode(re.newRecoveryKey)));
  });
});

describe('keychain.decryptKeyPair', () => {
  it('returns publicKey + privateKey decrypted under masterKey', async () => {
    const r = await bootstrap('pw-decrypt-horse');
    const kp = await decryptKeyPair(
      r.registerBody.encryptedPrivateKey,
      r.registerBody.publicKey,
      r.masterKey,
    );
    expect(kp.publicKey).toEqual(r.publicKey);

    const sample = new Uint8Array([1, 2, 3]);
    const { encryptSymmetric } = await import('@blindpass/crypto');
    const enc = await encryptSymmetric(sample, r.masterKey);
    expect(await decryptSymmetric(enc, r.masterKey)).toEqual(sample);
  });
});
