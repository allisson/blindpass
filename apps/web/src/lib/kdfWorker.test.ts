import { afterEach, describe, expect, it, vi } from 'vitest';

const { MockKdfWorker, getLastWorker } = vi.hoisted(() => {
  let lastWorker: {
    onmessage: ((e: MessageEvent) => void) | null;
    onerror: ((e: ErrorEvent) => void) | null;
    postMessage: (...args: unknown[]) => void;
  } | null = null;

  class MockKdfWorker {
    onmessage: ((e: MessageEvent) => void) | null = null;
    onerror: ((e: ErrorEvent) => void) | null = null;

    constructor() {
      // eslint-disable-next-line @typescript-eslint/no-this-alias
      lastWorker = this;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    postMessage(_data: unknown, _transfer?: unknown) {}
  }

  return {
    MockKdfWorker,
    getLastWorker: () => lastWorker,
  };
});

vi.mock('@/workers/kdf.worker?worker', () => ({ default: MockKdfWorker }));

import { deriveKEK } from './kdfWorker';

afterEach(() => {
  vi.clearAllMocks();
});

describe('deriveKEK', () => {
  it('resolves with Uint8Array when worker posts ok:true', async () => {
    const salt = new Uint8Array([1, 2, 3, 4]);
    const promise = deriveKEK('correct-horse', salt);
    const worker = getLastWorker()!;
    worker.onmessage?.({ data: { ok: true, kek: [10, 20, 30] } } as MessageEvent);
    const result = await promise;
    expect(result).toBeInstanceOf(Uint8Array);
    expect(Array.from(result)).toEqual([10, 20, 30]);
  });

  it('rejects when worker posts ok:false with error string', async () => {
    const salt = new Uint8Array([1, 2, 3, 4]);
    const promise = deriveKEK('wrong', salt);
    const worker = getLastWorker()!;
    worker.onmessage?.({ data: { ok: false, error: 'kdf failed' } } as MessageEvent);
    await expect(promise).rejects.toThrow('kdf failed');
  });

  it('rejects when worker fires onerror', async () => {
    const salt = new Uint8Array([5, 6, 7, 8]);
    const promise = deriveKEK('pass', salt);
    const worker = getLastWorker()!;
    worker.onerror?.({ message: 'worker crashed' } as ErrorEvent);
    await expect(promise).rejects.toThrow('worker crashed');
  });

  it('reuses the same worker instance across calls', async () => {
    const salt = new Uint8Array(4);
    const firstWorker = getLastWorker();

    const p = deriveKEK('pass', salt);
    const secondWorker = getLastWorker();
    secondWorker!.onmessage?.({ data: { ok: true, kek: [1] } } as MessageEvent);
    await p;

    expect(getLastWorker()).toBe(firstWorker);
  });
});
