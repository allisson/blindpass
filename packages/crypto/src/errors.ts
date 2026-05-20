export class CryptoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CryptoError';
  }
}

export class DecryptionError extends CryptoError {
  constructor(message: string) {
    super(message);
    this.name = 'DecryptionError';
  }
}
