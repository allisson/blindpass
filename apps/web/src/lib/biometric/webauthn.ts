/**
 * WebAuthn wrappers for biometric unlock.
 *
 * Uses the `prf` extension to derive a deterministic 32-byte secret per
 * (credential, salt), gated by the platform authenticator. The PRF output is
 * the BUK (Biometric Unlock Key) — used to wrap MasterKey at rest.
 */

/** Copies into a fresh ArrayBuffer-backed Uint8Array (required by lib.dom WebAuthn types). */
function buf(src: Uint8Array): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(src.length);
  out.set(src);
  return out;
}

export type PrfSupportReason = 'no_webauthn' | 'no_platform_authenticator' | 'prf_unsupported';

export type PrfSupport = { supported: true } | { supported: false; reason: PrfSupportReason };

/**
 * Thrown when the chosen passkey provider stored a credential but did not
 * honour the `prf` extension (`getClientExtensionResults().prf.enabled` is
 * falsy). The credential exists in the user's password manager but cannot
 * derive a BUK. See `docs/agents/biometric-compat.md`.
 */
export class PrfNotEnabledError extends Error {
  readonly code = 'prf-not-enabled' as const;
  constructor() {
    super('PRF extension not enabled by the selected passkey provider');
    this.name = 'PrfNotEnabledError';
  }
}

interface ClientCapabilities {
  [key: string]: boolean | undefined;
  prf?: boolean;
  extension_prf?: boolean;
  'extension:prf'?: boolean;
}

interface PublicKeyCredentialStatic {
  isUserVerifyingPlatformAuthenticatorAvailable?: () => Promise<boolean>;
  getClientCapabilities?: () => Promise<ClientCapabilities>;
}

/**
 * Structural-only probe. Does not create a credential — would otherwise prompt
 * the user for biometric. PRF presence is confirmed at first real enrollment
 * via `cred.getClientExtensionResults().prf?.enabled === true`.
 */
export async function probePrfSupport(): Promise<PrfSupport> {
  if (typeof window === 'undefined' || !window.PublicKeyCredential) {
    return { supported: false, reason: 'no_webauthn' };
  }
  const PKC = window.PublicKeyCredential as unknown as PublicKeyCredentialStatic;

  if (typeof PKC.isUserVerifyingPlatformAuthenticatorAvailable === 'function') {
    const available = await PKC.isUserVerifyingPlatformAuthenticatorAvailable();
    if (!available) return { supported: false, reason: 'no_platform_authenticator' };
  }

  if (typeof PKC.getClientCapabilities === 'function') {
    try {
      const caps = await PKC.getClientCapabilities();
      const prf = caps.prf ?? caps.extension_prf ?? caps['extension:prf'];
      if (prf === false) return { supported: false, reason: 'prf_unsupported' };
    } catch {
      /* advisory — ignore failures */
    }
  }

  return { supported: true };
}

export interface RegisterParams {
  rpId: string;
  rpName: string;
  username: string;
  userId: Uint8Array;
  prfSalt: Uint8Array;
}

export interface RegisterResult {
  credentialId: Uint8Array;
  prfOutput: Uint8Array;
}

/**
 * Registers a platform authenticator credential and derives the PRF output
 * at registration time. If the authenticator does not honour the PRF extension,
 * throws — caller should surface "PRF not supported on this device".
 *
 * Some platforms (e.g. Windows Hello) only return PRF on a subsequent
 * assertion. In that case we follow up with a same-credential `get()` call to
 * harvest the PRF output, requiring a second user-verification gesture.
 */
export async function registerBiometric(params: RegisterParams): Promise<RegisterResult> {
  const challenge = crypto.getRandomValues(new Uint8Array(32));

  const cred = (await navigator.credentials.create({
    publicKey: {
      rp: { id: params.rpId, name: params.rpName },
      user: {
        id: buf(params.userId),
        name: params.username,
        displayName: params.username,
      },
      challenge,
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 }, // ES256
        { type: 'public-key', alg: -257 }, // RS256
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'required',
        residentKey: 'preferred',
      },
      timeout: 60_000,
      extensions: {
        prf: { eval: { first: buf(params.prfSalt) } },
      },
    } satisfies PublicKeyCredentialCreationOptions,
  })) as PublicKeyCredential | null;

  if (!cred) throw new Error('Biometric enrollment failed: no credential');

  const ext = cred.getClientExtensionResults() as {
    prf?: { enabled?: boolean; results?: { first?: ArrayBuffer } };
  };

  if (!ext.prf?.enabled) {
    throw new PrfNotEnabledError();
  }

  const credentialId = new Uint8Array(cred.rawId);

  if (ext.prf.results?.first) {
    return { credentialId, prfOutput: new Uint8Array(ext.prf.results.first) };
  }

  // Some platforms (notably Windows Hello) require a follow-up assertion to
  // emit PRF results. Make one here so enrollment yields a usable BUK.
  const prfOutput = await assertBiometric({
    rpId: params.rpId,
    credentialId,
    prfSalt: params.prfSalt,
  });
  return { credentialId, prfOutput };
}

export interface AssertParams {
  rpId: string;
  credentialId: Uint8Array;
  prfSalt: Uint8Array;
}

export async function assertBiometric(params: AssertParams): Promise<Uint8Array> {
  const challenge = crypto.getRandomValues(new Uint8Array(32));

  const assertion = (await navigator.credentials.get({
    publicKey: {
      rpId: params.rpId,
      challenge,
      allowCredentials: [{ id: buf(params.credentialId), type: 'public-key' }],
      userVerification: 'required',
      timeout: 60_000,
      extensions: {
        prf: { eval: { first: buf(params.prfSalt) } },
      },
    } satisfies PublicKeyCredentialRequestOptions,
  })) as PublicKeyCredential | null;

  if (!assertion) throw new Error('Biometric unlock failed: no assertion');

  const ext = assertion.getClientExtensionResults() as {
    prf?: { results?: { first?: ArrayBuffer } };
  };

  if (!ext.prf?.results?.first) {
    throw new Error('Biometric unlock failed: PRF output unavailable');
  }

  return new Uint8Array(ext.prf.results.first);
}

/**
 * `NotAllowedError` (user cancelled or timed out) and `InvalidStateError`
 * (the credential is no longer recognised by the authenticator, e.g. the OS
 * biometric enrollment was wiped) both indicate the local enrollment record
 * should be discarded so the user falls back to password.
 */
export function isUnrecoverableAssertionError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  return err.name === 'InvalidStateError';
}

export function isUserCancelled(err: unknown): boolean {
  return err instanceof Error && err.name === 'NotAllowedError';
}
