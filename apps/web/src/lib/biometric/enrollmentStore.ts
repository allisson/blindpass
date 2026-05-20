import type { EncryptedValue } from '@blindpass/crypto';

export const ENROLLMENT_VERSION = 1;

export interface BiometricEnrollment {
  version: 1;
  username: string;
  credentialId: Uint8Array;
  prfSalt: Uint8Array;
  encryptedMasterKey: EncryptedValue;
  rpId: string;
  createdAt: string;
  label?: string;
  serverCredentialId?: string;
}

const DB_NAME = 'bp:biometric-unlock';
const DB_VERSION = 1;
const STORE = 'enrollment';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      /* c8 ignore next */
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'username' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    /* c8 ignore next */
    req.onerror = () => reject(req.error);
  });
}

export const enrollmentStore = {
  async get(username: string): Promise<BiometricEnrollment | null> {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(username);
      req.onsuccess = () => resolve((req.result as BiometricEnrollment) ?? null);
      /* c8 ignore next */
      req.onerror = () => reject(req.error);
    });
  },

  async put(record: BiometricEnrollment): Promise<void> {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(record);
      tx.oncomplete = () => resolve();
      /* c8 ignore next */
      tx.onerror = () => reject(tx.error);
    });
  },

  async delete(username: string): Promise<void> {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(username);
      tx.oncomplete = () => resolve();
      /* c8 ignore next */
      tx.onerror = () => reject(tx.error);
    });
  },

  async clearAll(): Promise<void> {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).clear();
      tx.oncomplete = () => resolve();
      /* c8 ignore next */
      tx.onerror = () => reject(tx.error);
    });
  },
};
