import { unzip as _unzip } from 'fflate';

const MAX_TOTAL_SIZE = 100 * 1024 * 1024; // 100 MB
const MAX_ENTRIES = 10_000;

export class ZipError extends Error {}

export function readZip(bytes: Uint8Array): Promise<Map<string, Uint8Array>> {
  return new Promise((resolve, reject) => {
    let totalDeclaredSize = 0;
    let entryCount = 0;
    let abortedReason: string | null = null;

    _unzip(
      bytes,
      {
        filter: (file) => {
          if (abortedReason) return false;
          entryCount++;
          if (entryCount > MAX_ENTRIES) {
            abortedReason = `Zip exceeds ${MAX_ENTRIES}-entry limit`;
            return false;
          }
          totalDeclaredSize += file.size;
          if (totalDeclaredSize > MAX_TOTAL_SIZE) {
            abortedReason = 'Zip exceeds 100 MB total-size limit';
            return false;
          }
          return true;
        },
      },
      (err, data) => {
        if (err) return reject(new ZipError(err.message));
        if (abortedReason) return reject(new ZipError(abortedReason));

        let inflated = 0;
        const result = new Map<string, Uint8Array>();
        for (const [name, content] of Object.entries(data)) {
          inflated += content.byteLength;
          if (inflated > MAX_TOTAL_SIZE) {
            return reject(new ZipError('Inflated content exceeds 100 MB budget'));
          }
          result.set(name, content);
        }
        resolve(result);
      },
    );
  });
}
