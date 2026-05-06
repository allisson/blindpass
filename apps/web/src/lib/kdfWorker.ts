import KdfWorker from '@/workers/kdf.worker?worker';

let worker: Worker | null = null;

function getWorker(): Worker {
  if (!worker) worker = new KdfWorker();
  return worker;
}

export function deriveKEK(password: string, salt: Uint8Array): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const w = getWorker();
    const saltBuf = salt.buffer.slice(salt.byteOffset, salt.byteOffset + salt.byteLength);
    w.onmessage = (e) => {
      if (e.data.ok) resolve(new Uint8Array(e.data.kek));
      else reject(new Error(e.data.error));
    };
    w.onerror = (e) => reject(new Error(e.message));
    w.postMessage({ password, salt: saltBuf }, [saltBuf]);
  });
}
