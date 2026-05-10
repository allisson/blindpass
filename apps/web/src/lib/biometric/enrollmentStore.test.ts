import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { enrollmentStore, ENROLLMENT_VERSION, type BiometricEnrollment } from './enrollmentStore';

const sample = (username: string): BiometricEnrollment => ({
  version: ENROLLMENT_VERSION,
  username,
  credentialId: new Uint8Array([1, 2, 3]),
  prfSalt: new Uint8Array([4, 5, 6]),
  encryptedMasterKey: { ciphertext: new Uint8Array([7]), nonce: new Uint8Array([8]) },
  rpId: 'localhost',
  createdAt: '2026-05-09T00:00:00.000Z',
});

beforeEach(() => {
  vi.stubGlobal('indexedDB', new IDBFactory());
});

describe('enrollmentStore', () => {
  it('returns null when no record exists', async () => {
    expect(await enrollmentStore.get('alice')).toBeNull();
  });

  it('stores and retrieves a record', async () => {
    await enrollmentStore.put(sample('alice'));
    const out = await enrollmentStore.get('alice');
    expect(out).not.toBeNull();
    expect(out?.username).toBe('alice');
    expect(out?.rpId).toBe('localhost');
  });

  it('overwrites an existing record on put', async () => {
    await enrollmentStore.put(sample('alice'));
    await enrollmentStore.put({ ...sample('alice'), rpId: 'example.com' });
    const out = await enrollmentStore.get('alice');
    expect(out?.rpId).toBe('example.com');
  });

  it('deletes a single record by username', async () => {
    await enrollmentStore.put(sample('alice'));
    await enrollmentStore.put(sample('bob'));
    await enrollmentStore.delete('alice');
    expect(await enrollmentStore.get('alice')).toBeNull();
    expect(await enrollmentStore.get('bob')).not.toBeNull();
  });

  it('clearAll removes every record', async () => {
    await enrollmentStore.put(sample('alice'));
    await enrollmentStore.put(sample('bob'));
    await enrollmentStore.clearAll();
    expect(await enrollmentStore.get('alice')).toBeNull();
    expect(await enrollmentStore.get('bob')).toBeNull();
  });
});
