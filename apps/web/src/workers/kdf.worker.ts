/// <reference lib="webworker" />
import { deriveKeyEncryptionKey } from '@blindpass/crypto';

// E2E-only: skip expensive Argon2id params so tests run in milliseconds instead of seconds.
// Never set VITE_E2E_KDF_FAST in production builds.
const E2E_FAST = import.meta.env.VITE_E2E_KDF_FAST === 'true';
const FAST_OPS = 2; // well-tested minimum; OPSLIMIT_INTERACTIVE = 2
const FAST_MEM = 65536; // 64 KB vs 1 GB SENSITIVE

self.onmessage = async (e: MessageEvent<{ password: string; salt: ArrayBuffer }>) => {
  try {
    const kek = await deriveKeyEncryptionKey(
      e.data.password, // JS strings are immutable; cannot zero. Accepted: GC reclaims after postMessage.
      new Uint8Array(e.data.salt),
      E2E_FAST ? FAST_OPS : undefined,
      E2E_FAST ? FAST_MEM : undefined,
    );
    const buf = new ArrayBuffer(kek.byteLength);
    new Uint8Array(buf).set(kek);
    kek.fill(0);
    self.postMessage({ ok: true, kek: buf }, [buf]);
  } catch (err) {
    self.postMessage({ ok: false, error: String(err) });
  }
};
