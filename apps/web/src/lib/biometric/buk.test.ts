import { describe, expect, it } from 'vitest';
import { generateKey } from '@blindpass/crypto';
import { wrapMasterKey, unwrapMasterKey } from './buk';

describe('buk wrap/unwrap', () => {
  it('round-trips a masterKey through a BUK', async () => {
    const masterKey = await generateKey();
    const buk = await generateKey();
    const masterKeyCopy = new Uint8Array(masterKey);
    const bukCopy = new Uint8Array(buk);

    const env = await wrapMasterKey(masterKey, buk);

    // BUK is zeroed after use
    expect(buk.every((b) => b === 0)).toBe(true);

    const out = await unwrapMasterKey(env, bukCopy);
    expect(out).toEqual(masterKeyCopy);
  });

  it('throws on wrong BUK', async () => {
    const masterKey = await generateKey();
    const buk = await generateKey();
    const env = await wrapMasterKey(masterKey, buk);

    const wrongBuk = await generateKey();
    await expect(unwrapMasterKey(env, wrongBuk)).rejects.toThrow();
  });
});
