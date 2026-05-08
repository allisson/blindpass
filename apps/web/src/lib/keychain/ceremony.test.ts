import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api';
import { mapCeremonyError, runCeremony, type CeremonyError, type CeremonyPhase } from './ceremony';

function makeHooks() {
  const phases: CeremonyPhase[] = [];
  const errors: (CeremonyError | null)[] = [];
  return {
    phases,
    errors,
    setPhase: (p: CeremonyPhase) => phases.push(p),
    setError: (e: CeremonyError | null) => errors.push(e),
  };
}

describe('mapCeremonyError', () => {
  it('maps 401 ApiError to session_expired', () => {
    const err = mapCeremonyError(new ApiError(401, 'forbidden'));
    expect(err.code).toBe('session_expired');
  });

  it('maps non-401 ApiError to network', () => {
    const err = mapCeremonyError(new ApiError(500, 'boom'));
    expect(err.code).toBe('network');
  });

  it('maps mac/ciphertext errors to wrong_password', () => {
    expect(mapCeremonyError(new Error('bad mac')).code).toBe('wrong_password');
    expect(mapCeremonyError(new Error('invalid ciphertext')).code).toBe('wrong_password');
  });

  it('maps "no vault" to no_vault', () => {
    expect(mapCeremonyError(new Error('No vault found.')).code).toBe('no_vault');
  });

  it('maps argon/kdf to kdf_failed', () => {
    expect(mapCeremonyError(new Error('argon2 failed')).code).toBe('kdf_failed');
  });

  it('falls back to unknown for arbitrary values', () => {
    expect(mapCeremonyError({ weird: true }).code).toBe('unknown');
  });
});

describe('runCeremony', () => {
  it('runs steps and emits done on success', async () => {
    const hooks = makeHooks();
    const result = await runCeremony(async (ctx) => {
      ctx.setPhase('fetching_keys');
      return 42;
    }, hooks);
    expect(result).toEqual({ ok: true, value: 42 });
    expect(hooks.phases).toEqual(['idle', 'fetching_keys', 'done']);
  });

  it('zeros tracked keys on failure and returns mapped error', async () => {
    const hooks = makeHooks();
    const k = new Uint8Array([1, 2, 3]);
    const result = await runCeremony(async (ctx) => {
      ctx.trackForZero(k);
      throw new Error('bad mac');
    }, hooks);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('wrong_password');
    expect(Array.from(k)).toEqual([0, 0, 0]);
    expect(hooks.phases.at(-1)).toBe('error');
  });

  it('does not zero tracked keys on success after release', async () => {
    const hooks = makeHooks();
    const k = new Uint8Array([7, 7, 7]);
    await runCeremony(async (ctx) => {
      ctx.trackForZero(k);
      ctx.releaseTrackedKeys();
      return null;
    }, hooks);
    expect(Array.from(k)).toEqual([7, 7, 7]);
  });

  it('clears prior error on each run', async () => {
    const hooks = makeHooks();
    await runCeremony(async () => {
      throw new Error('first');
    }, hooks);
    await runCeremony(async () => 1, hooks);
    expect(hooks.errors[0]).toBeNull();
    expect(hooks.errors[1]).not.toBeNull();
    expect(hooks.errors[2]).toBeNull();
  });

  it('forwards setPhase calls from steps', async () => {
    const setPhase = vi.fn();
    await runCeremony(
      async (ctx) => {
        ctx.setPhase('decrypting');
        ctx.setPhase('finalizing');
        return null;
      },
      { setPhase, setError: () => {} },
    );
    expect(setPhase).toHaveBeenNthCalledWith(2, 'decrypting');
    expect(setPhase).toHaveBeenNthCalledWith(3, 'finalizing');
  });
});
