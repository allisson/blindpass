import { describe, it, expect } from 'vitest';
import {
  LookupByEmailQuerySchema,
  KeysResponseSchema,
  UpdateKeysRequestSchema,
  ChangePasswordRequestSchema,
  DeleteAccountRequestSchema,
} from './user.js';

const b64 = 'dGVzdA==';
const encVal = { ciphertext: b64, nonce: b64 };

const keysPayload = {
  kekSalt: b64,
  publicKey: b64,
  encryptedMasterKey: encVal,
  encryptedMasterKeyForRecovery: encVal,
  encryptedPrivateKey: encVal,
  encryptedRecoveryKey: encVal,
};

describe('KeysResponseSchema', () => {
  it('accepts valid keys response', () => {
    expect(KeysResponseSchema.safeParse(keysPayload).success).toBe(true);
  });

  it('rejects missing encryptedMasterKey', () => {
    expect(
      KeysResponseSchema.safeParse({ ...keysPayload, encryptedMasterKey: undefined }).success,
    ).toBe(false);
  });

  it('rejects invalid encrypted value shape', () => {
    expect(
      KeysResponseSchema.safeParse({ ...keysPayload, encryptedMasterKey: 'bad' }).success,
    ).toBe(false);
  });
});

describe('UpdateKeysRequestSchema', () => {
  it('accepts same shape as KeysResponse', () => {
    expect(UpdateKeysRequestSchema.safeParse(keysPayload).success).toBe(true);
  });

  it('rejects missing field', () => {
    expect(
      UpdateKeysRequestSchema.safeParse({ ...keysPayload, publicKey: undefined }).success,
    ).toBe(false);
  });
});

describe('ChangePasswordRequestSchema', () => {
  const valid = {
    authenticatorCode: '123456',
    kekSalt: b64,
    encryptedMasterKey: encVal,
  };

  it('accepts valid payload', () => {
    expect(ChangePasswordRequestSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects non-numeric OTP code', () => {
    expect(
      ChangePasswordRequestSchema.safeParse({ ...valid, authenticatorCode: 'abcdef' }).success,
    ).toBe(false);
  });

  it('rejects wrong-length OTP code', () => {
    expect(
      ChangePasswordRequestSchema.safeParse({ ...valid, authenticatorCode: '12345' }).success,
    ).toBe(false);
  });

  it('rejects missing kekSalt', () => {
    expect(ChangePasswordRequestSchema.safeParse({ ...valid, kekSalt: undefined }).success).toBe(
      false,
    );
  });
});

describe('DeleteAccountRequestSchema', () => {
  it('accepts valid 6-digit OTP', () => {
    expect(DeleteAccountRequestSchema.safeParse({ authenticatorCode: '000000' }).success).toBe(
      true,
    );
  });

  it('rejects missing OTP', () => {
    expect(DeleteAccountRequestSchema.safeParse({}).success).toBe(false);
  });

  it('rejects non-numeric OTP', () => {
    expect(DeleteAccountRequestSchema.safeParse({ authenticatorCode: 'aaaaaa' }).success).toBe(
      false,
    );
  });
});

describe('LookupByEmailQuerySchema', () => {
  it('accepts valid username', () => {
    expect(LookupByEmailQuerySchema.safeParse({ username: 'blindpass_user' }).success).toBe(true);
  });

  it('rejects invalid username', () => {
    expect(LookupByEmailQuerySchema.safeParse({ username: 'not-valid' }).success).toBe(false);
  });

  it('rejects missing username', () => {
    expect(LookupByEmailQuerySchema.safeParse({}).success).toBe(false);
  });
});
