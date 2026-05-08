import { describe, expect, it } from 'vitest';
import { fromUserRow } from '../from-user-row.js';

describe('bundle.fromUserRow', () => {
  it('returns empty strings for an all-null row', () => {
    const b = fromUserRow({
      publicKey: null,
      kekSalt: null,
      encryptedMasterKeyCiphertext: null,
      encryptedMasterKeyNonce: null,
      encryptedMasterKeyForRecoveryCiphertext: null,
      encryptedMasterKeyForRecoveryNonce: null,
      encryptedPrivateKeyCiphertext: null,
      encryptedPrivateKeyNonce: null,
      encryptedRecoveryKeyCiphertext: null,
      encryptedRecoveryKeyNonce: null,
    });
    expect(b).toEqual({
      publicKey: '',
      kekSalt: '',
      encryptedMasterKey: { ciphertext: '', nonce: '' },
      encryptedMasterKeyForRecovery: { ciphertext: '', nonce: '' },
      encryptedPrivateKey: { ciphertext: '', nonce: '' },
      encryptedRecoveryKey: { ciphertext: '', nonce: '' },
    });
  });

  it('encodes every Buffer column to base64', () => {
    const buf = (s: string) => Buffer.from(s, 'utf8');
    const b = fromUserRow({
      publicKey: buf('PK'),
      kekSalt: buf('KS'),
      encryptedMasterKeyCiphertext: buf('MK-C'),
      encryptedMasterKeyNonce: buf('MK-N'),
      encryptedMasterKeyForRecoveryCiphertext: buf('MR-C'),
      encryptedMasterKeyForRecoveryNonce: buf('MR-N'),
      encryptedPrivateKeyCiphertext: buf('PR-C'),
      encryptedPrivateKeyNonce: buf('PR-N'),
      encryptedRecoveryKeyCiphertext: buf('RK-C'),
      encryptedRecoveryKeyNonce: buf('RK-N'),
    });
    expect(b.publicKey).toBe(buf('PK').toString('base64'));
    expect(b.encryptedMasterKey.ciphertext).toBe(buf('MK-C').toString('base64'));
    expect(b.encryptedMasterKey.nonce).toBe(buf('MK-N').toString('base64'));
    expect(b.encryptedRecoveryKey.nonce).toBe(buf('RK-N').toString('base64'));
  });
});
