export function toBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

export function fromBase64(s: string): Uint8Array {
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}

export function toBase64EncryptedValue(ev: { ciphertext: Uint8Array; nonce: Uint8Array }) {
  return { ciphertext: toBase64(ev.ciphertext), nonce: toBase64(ev.nonce) };
}

export function fromBase64EncryptedValue(ev: { ciphertext: string; nonce: string }) {
  return { ciphertext: fromBase64(ev.ciphertext), nonce: fromBase64(ev.nonce) };
}
