import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  probePrfSupport,
  registerBiometric,
  assertBiometric,
  isUserCancelled,
  isUnrecoverableAssertionError,
  PrfNotEnabledError,
} from './webauthn';

interface PkcStub {
  isUserVerifyingPlatformAuthenticatorAvailable?: () => Promise<boolean>;
  getClientCapabilities?: () => Promise<Record<string, boolean | undefined>>;
}

function stubWindow(pkc?: PkcStub | null) {
  if (pkc === null) {
    vi.stubGlobal('window', {} as unknown as Window);
    return;
  }
  vi.stubGlobal('window', { PublicKeyCredential: pkc ?? {} } as unknown as Window);
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('probePrfSupport', () => {
  it('returns no_webauthn when PublicKeyCredential is missing', async () => {
    stubWindow(null);
    const r = await probePrfSupport();
    expect(r).toEqual({ supported: false, reason: 'no_webauthn' });
  });

  it('returns no_platform_authenticator when platform UV is unavailable', async () => {
    stubWindow({ isUserVerifyingPlatformAuthenticatorAvailable: async () => false });
    const r = await probePrfSupport();
    expect(r).toEqual({ supported: false, reason: 'no_platform_authenticator' });
  });

  it('returns prf_unsupported when getClientCapabilities reports prf=false', async () => {
    stubWindow({
      isUserVerifyingPlatformAuthenticatorAvailable: async () => true,
      getClientCapabilities: async () => ({ prf: false }),
    });
    const r = await probePrfSupport();
    expect(r).toEqual({ supported: false, reason: 'prf_unsupported' });
  });

  it('returns supported when capabilities advertise prf=true', async () => {
    stubWindow({
      isUserVerifyingPlatformAuthenticatorAvailable: async () => true,
      getClientCapabilities: async () => ({ prf: true }),
    });
    expect(await probePrfSupport()).toEqual({ supported: true });
  });

  it('returns supported when getClientCapabilities is missing', async () => {
    stubWindow({
      isUserVerifyingPlatformAuthenticatorAvailable: async () => true,
    });
    expect(await probePrfSupport()).toEqual({ supported: true });
  });

  it('treats getClientCapabilities throw as advisory and continues', async () => {
    stubWindow({
      isUserVerifyingPlatformAuthenticatorAvailable: async () => true,
      getClientCapabilities: async () => {
        throw new Error('boom');
      },
    });
    expect(await probePrfSupport()).toEqual({ supported: true });
  });

  it('treats absent isUserVerifyingPlatformAuthenticatorAvailable as advisory', async () => {
    stubWindow({});
    expect(await probePrfSupport()).toEqual({ supported: true });
  });
});

describe('error classifiers', () => {
  it('isUserCancelled detects NotAllowedError', () => {
    const err = new Error('cancelled');
    err.name = 'NotAllowedError';
    expect(isUserCancelled(err)).toBe(true);
    expect(isUserCancelled(new Error('other'))).toBe(false);
    expect(isUserCancelled('not an error')).toBe(false);
  });

  it('isUnrecoverableAssertionError detects InvalidStateError', () => {
    const err = new Error('gone');
    err.name = 'InvalidStateError';
    expect(isUnrecoverableAssertionError(err)).toBe(true);
    expect(isUnrecoverableAssertionError(new Error('other'))).toBe(false);
    expect(isUnrecoverableAssertionError(undefined)).toBe(false);
  });
});

describe('registerBiometric / assertBiometric', () => {
  function stubCredentials(create: unknown, get: unknown = create) {
    vi.stubGlobal('navigator', {
      credentials: {
        create: vi.fn().mockResolvedValue(create),
        get: vi.fn().mockResolvedValue(get),
      },
    } as unknown as Navigator);
    vi.stubGlobal('crypto', {
      getRandomValues: (arr: Uint8Array) => arr.fill(7),
    } as unknown as Crypto);
  }

  it('registerBiometric returns prfOutput when present at create time', async () => {
    const prfBuffer = new Uint8Array([9, 9, 9]).buffer;
    const credentialId = new Uint8Array([1, 2]).buffer;
    stubCredentials({
      rawId: credentialId,
      getClientExtensionResults: () => ({
        prf: { enabled: true, results: { first: prfBuffer } },
      }),
    });

    const result = await registerBiometric({
      rpId: 'localhost',
      rpName: 'BlindPass',
      username: 'alice',
      userId: new Uint8Array([10]),
      prfSalt: new Uint8Array([20]),
    });

    expect(Array.from(result.credentialId)).toEqual([1, 2]);
    expect(Array.from(result.prfOutput)).toEqual([9, 9, 9]);
  });

  it('registerBiometric throws PrfNotEnabledError when prf is not enabled', async () => {
    stubCredentials({
      rawId: new Uint8Array([1]).buffer,
      getClientExtensionResults: () => ({ prf: { enabled: false } }),
    });

    const promise = registerBiometric({
      rpId: 'localhost',
      rpName: 'BlindPass',
      username: 'alice',
      userId: new Uint8Array([10]),
      prfSalt: new Uint8Array([20]),
    });
    await expect(promise).rejects.toBeInstanceOf(PrfNotEnabledError);
    await expect(promise).rejects.toMatchObject({ code: 'prf-not-enabled' });
  });

  it('registerBiometric throws when no credential is returned', async () => {
    stubCredentials(null);
    await expect(
      registerBiometric({
        rpId: 'localhost',
        rpName: 'BlindPass',
        username: 'alice',
        userId: new Uint8Array([10]),
        prfSalt: new Uint8Array([20]),
      }),
    ).rejects.toThrow();
  });

  it('registerBiometric harvests PRF via follow-up assertion when missing at create', async () => {
    const credentialId = new Uint8Array([1, 2]).buffer;
    const createResult = {
      rawId: credentialId,
      getClientExtensionResults: () => ({ prf: { enabled: true } }),
    };
    const assertResult = {
      getClientExtensionResults: () => ({
        prf: { results: { first: new Uint8Array([5, 5]).buffer } },
      }),
    };
    stubCredentials(createResult, assertResult);

    const result = await registerBiometric({
      rpId: 'localhost',
      rpName: 'BlindPass',
      username: 'alice',
      userId: new Uint8Array([10]),
      prfSalt: new Uint8Array([20]),
    });

    expect(Array.from(result.prfOutput)).toEqual([5, 5]);
  });

  it('assertBiometric returns prf output bytes', async () => {
    stubCredentials(null, {
      getClientExtensionResults: () => ({
        prf: { results: { first: new Uint8Array([7, 7]).buffer } },
      }),
    });

    const out = await assertBiometric({
      rpId: 'localhost',
      credentialId: new Uint8Array([1]),
      prfSalt: new Uint8Array([2]),
    });
    expect(Array.from(out)).toEqual([7, 7]);
  });

  it('assertBiometric throws when no assertion is returned', async () => {
    stubCredentials(null, null);
    await expect(
      assertBiometric({
        rpId: 'localhost',
        credentialId: new Uint8Array([1]),
        prfSalt: new Uint8Array([2]),
      }),
    ).rejects.toThrow();
  });

  it('assertBiometric throws when prf output is missing', async () => {
    stubCredentials(null, {
      getClientExtensionResults: () => ({}),
    });
    await expect(
      assertBiometric({
        rpId: 'localhost',
        credentialId: new Uint8Array([1]),
        prfSalt: new Uint8Array([2]),
      }),
    ).rejects.toThrow(/PRF/);
  });
});
