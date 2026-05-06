import { describe, it, expect } from 'vitest';
import {
  Base64StringSchema,
  EncryptedValueSchema,
  UsernameSchema,
  AuthenticatorCodeSchema,
  RegisterRequestSchema,
  StartLoginRequestSchema,
  CompleteLoginRequestSchema,
  CompleteRegistrationRequestSchema,
  CompleteRegistrationResponseSchema,
  StartRecoveryRequestSchema,
  VerifyRecoveryRequestSchema,
  VerifyRecoveryResponseSchema,
  CompleteRecoveryRequestSchema,
  StartTotpRotationRequestSchema,
  StartTotpRotationResponseSchema,
} from './auth.js';

const b64 = 'dGVzdA==';
const encVal = { ciphertext: b64, nonce: b64 };

describe('Base64StringSchema', () => {
  it('accepts valid base64 with padding', () => {
    expect(Base64StringSchema.safeParse('dGVzdA==').success).toBe(true);
    expect(Base64StringSchema.safeParse('aGVsbG8=').success).toBe(true);
    expect(Base64StringSchema.safeParse('Zm9v').success).toBe(true);
  });

  it('rejects empty string', () => {
    expect(Base64StringSchema.safeParse('').success).toBe(false);
  });

  it('rejects non-base64 characters', () => {
    expect(Base64StringSchema.safeParse('not-valid!').success).toBe(false);
    expect(Base64StringSchema.safeParse('hello world').success).toBe(false);
  });

  it('rejects wrong padding', () => {
    expect(Base64StringSchema.safeParse('dGVz=').success).toBe(false);
  });
});

describe('EncryptedValueSchema', () => {
  it('accepts valid ciphertext and nonce', () => {
    expect(EncryptedValueSchema.safeParse(encVal).success).toBe(true);
  });

  it('rejects missing ciphertext', () => {
    expect(EncryptedValueSchema.safeParse({ nonce: b64 }).success).toBe(false);
  });

  it('rejects missing nonce', () => {
    expect(EncryptedValueSchema.safeParse({ ciphertext: b64 }).success).toBe(false);
  });

  it('rejects non-base64 ciphertext', () => {
    expect(EncryptedValueSchema.safeParse({ ciphertext: 'bad!', nonce: b64 }).success).toBe(false);
  });
});

describe('RegisterRequestSchema', () => {
  const valid = {
    username: 'blindpass_user',
    kekSalt: b64,
    publicKey: b64,
    encryptedMasterKey: encVal,
    encryptedMasterKeyForRecovery: encVal,
    encryptedPrivateKey: encVal,
    encryptedRecoveryKey: encVal,
    encryptedVaultKey: encVal,
    encryptedVaultData: encVal,
    recoveryVerifier: 'cmVjb3Zlcnk=',
  };

  it('accepts valid registration payload', () => {
    expect(RegisterRequestSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects invalid username', () => {
    expect(RegisterRequestSchema.safeParse({ ...valid, username: 'Not-Valid' }).success).toBe(
      false,
    );
  });

  it('rejects missing required fields', () => {
    expect(
      RegisterRequestSchema.safeParse({ ...valid, encryptedMasterKey: undefined }).success,
    ).toBe(false);
  });

  it('rejects invalid encrypted value shape', () => {
    expect(
      RegisterRequestSchema.safeParse({ ...valid, encryptedMasterKey: { ciphertext: 'bad!' } })
        .success,
    ).toBe(false);
  });
});

describe('UsernameSchema', () => {
  it('accepts lowercase usernames', () => {
    expect(UsernameSchema.safeParse('blindpass_123').success).toBe(true);
  });

  it('rejects uppercase or punctuation', () => {
    expect(UsernameSchema.safeParse('BlindPass').success).toBe(false);
    expect(UsernameSchema.safeParse('blindpass-user').success).toBe(false);
  });
});

describe('AuthenticatorCodeSchema', () => {
  it('accepts valid 6-digit codes', () => {
    expect(AuthenticatorCodeSchema.safeParse('123456').success).toBe(true);
  });

  it('rejects non-numeric or wrong-length codes', () => {
    expect(AuthenticatorCodeSchema.safeParse('abcdef').success).toBe(false);
    expect(AuthenticatorCodeSchema.safeParse('12345').success).toBe(false);
  });
});

describe('StartLoginRequestSchema', () => {
  it('accepts username-only login start payload', () => {
    expect(StartLoginRequestSchema.safeParse({ username: 'blindpass_user' }).success).toBe(true);
  });

  it('rejects invalid username', () => {
    expect(StartLoginRequestSchema.safeParse({ username: 'BadUser' }).success).toBe(false);
  });
});

describe('CompleteLoginRequestSchema', () => {
  it('accepts username + authenticator code', () => {
    expect(
      CompleteLoginRequestSchema.safeParse({
        username: 'blindpass_user',
        authenticatorCode: '123456',
      }).success,
    ).toBe(true);
  });

  it('rejects invalid code', () => {
    expect(
      CompleteLoginRequestSchema.safeParse({
        username: 'blindpass_user',
        authenticatorCode: 'abcdef',
      }).success,
    ).toBe(false);
  });
});

describe('CompleteRegistrationRequestSchema', () => {
  it('accepts username + enrollmentId + authenticator code', () => {
    expect(
      CompleteRegistrationRequestSchema.safeParse({
        username: 'blindpass_user',
        enrollmentId: '123e4567-e89b-12d3-a456-426614174000',
        authenticatorCode: '123456',
      }).success,
    ).toBe(true);
  });
});

describe('CompleteRegistrationResponseSchema', () => {
  const ev = { ciphertext: 'YQ==', nonce: 'YQ==' };
  const validBundle = {
    publicKey: 'YQ==',
    kekSalt: 'YQ==',
    encryptedMasterKey: ev,
    encryptedMasterKeyForRecovery: ev,
    encryptedPrivateKey: ev,
    encryptedRecoveryKey: ev,
  };

  it('accepts valid key bundle', () => {
    expect(CompleteRegistrationResponseSchema.safeParse(validBundle).success).toBe(true);
  });

  it('does not contain encryptedAuthToken (cookie carries the session)', () => {
    const result = CompleteRegistrationResponseSchema.safeParse(validBundle);
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.data as Record<string, unknown>).encryptedAuthToken).toBeUndefined();
    }
  });

  it('rejects empty payload', () => {
    expect(CompleteRegistrationResponseSchema.safeParse({}).success).toBe(false);
  });

  it('rejects bundle missing publicKey', () => {
    const partial: Record<string, unknown> = { ...validBundle };
    delete partial['publicKey'];
    expect(CompleteRegistrationResponseSchema.safeParse(partial).success).toBe(false);
  });
});

describe('StartRecoveryRequestSchema', () => {
  it('accepts username-only recovery start payload', () => {
    expect(StartRecoveryRequestSchema.safeParse({ username: 'blindpass_user' }).success).toBe(true);
  });
});

describe('VerifyRecoveryRequestSchema', () => {
  it('accepts username + recovery verifier', () => {
    expect(
      VerifyRecoveryRequestSchema.safeParse({
        username: 'blindpass_user',
        recoveryVerifier: 'cmVjb3Zlcnk=',
      }).success,
    ).toBe(true);
  });
});

describe('VerifyRecoveryResponseSchema', () => {
  const ev = { ciphertext: 'YQ==', nonce: 'YQ==' };
  const valid = {
    recoveryToken: 'some-token',
    enrollment: {
      enrollmentId: '123e4567-e89b-12d3-a456-426614174000',
      setupKey: 'YQ==',
      otpauthUri: 'https://example.com/provisioning',
      expiresAt: new Date().toISOString(),
    },
    bundle: {
      publicKey: 'YQ==',
      kekSalt: 'YQ==',
      encryptedMasterKey: ev,
      encryptedMasterKeyForRecovery: ev,
      encryptedPrivateKey: ev,
      encryptedRecoveryKey: ev,
    },
  };

  it('accepts valid response', () => {
    expect(VerifyRecoveryResponseSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects missing recoveryToken', () => {
    expect(
      VerifyRecoveryResponseSchema.safeParse({ ...valid, recoveryToken: undefined }).success,
    ).toBe(false);
  });
});

describe('CompleteRecoveryRequestSchema', () => {
  const ev = { ciphertext: 'YQ==', nonce: 'YQ==' };
  const valid = {
    username: 'blindpass_user',
    recoveryToken: 'some-token',
    enrollmentId: '123e4567-e89b-12d3-a456-426614174000',
    authenticatorCode: '123456',
    kekSalt: 'YQ==',
    publicKey: 'YQ==',
    encryptedMasterKey: ev,
    encryptedMasterKeyForRecovery: ev,
    encryptedPrivateKey: ev,
    encryptedRecoveryKey: ev,
    recoveryVerifier: 'cmVjb3Zlcnk=',
  };

  it('accepts valid payload', () => {
    expect(CompleteRecoveryRequestSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects missing recoveryToken', () => {
    expect(
      CompleteRecoveryRequestSchema.safeParse({ ...valid, recoveryToken: undefined }).success,
    ).toBe(false);
  });

  it('rejects invalid username', () => {
    expect(
      CompleteRecoveryRequestSchema.safeParse({ ...valid, username: 'Not-Valid' }).success,
    ).toBe(false);
  });

  it('rejects invalid encrypted value shape', () => {
    expect(
      CompleteRecoveryRequestSchema.safeParse({ ...valid, encryptedMasterKey: 'bad' }).success,
    ).toBe(false);
  });
});

describe('StartTotpRotationRequestSchema', () => {
  it('accepts current authenticator code', () => {
    expect(StartTotpRotationRequestSchema.safeParse({ authenticatorCode: '123456' }).success).toBe(
      true,
    );
  });
});

describe('StartTotpRotationResponseSchema', () => {
  it('accepts enrollment payload', () => {
    expect(
      StartTotpRotationResponseSchema.safeParse({
        enrollment: {
          enrollmentId: '123e4567-e89b-12d3-a456-426614174000',
          setupKey: 'YQ==',
          otpauthUri: 'https://example.com/provisioning',
          expiresAt: new Date().toISOString(),
        },
      }).success,
    ).toBe(true);
  });
});
