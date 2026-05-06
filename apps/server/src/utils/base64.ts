/** Convert a Buffer/Uint8Array (or null/undefined) to a base64 string. */
export function toB64(buf: Buffer | Uint8Array | null | undefined): string {
  if (!buf) return '';
  return Buffer.from(buf).toString('base64');
}

/** Decode a base64 string to a Buffer. */
export function b64(s: string): Buffer {
  return Buffer.from(s, 'base64');
}
