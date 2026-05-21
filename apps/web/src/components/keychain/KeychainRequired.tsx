import { Navigate } from '@tanstack/react-router';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { decryptVaultItem, encryptVaultItem, type VaultItem } from '@blindpass/vault';
import {
  decryptSymmetric,
  encryptSymmetric,
  generateKey,
  type Keychain,
  type KeyPair,
} from '@blindpass/crypto';
import type { EncryptedVaultItem, VersionDetail } from '@blindpass/api-schema';
import { fromBase64EncryptedValue, toBase64EncryptedValue } from '@/lib/b64';
import { session, getLastUsername, type Session, type VaultEntry } from '@/lib/session';

export interface KeychainSnapshot {
  masterKey: Uint8Array;
  vaultKey: Uint8Array;
  keyPair: KeyPair;
  activeVaultId: string;
  vaults: Map<string, VaultEntry>;
  username?: string;
}

export interface DecryptedItemBase {
  id: string;
  folderId?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface KeychainHelpers {
  getVaultKey: (vaultId: string) => Uint8Array;
  decryptItem: (
    envelope: EncryptedVaultItem,
    vaultKey?: Uint8Array,
  ) => Promise<VaultItem & DecryptedItemBase>;
  decryptVersion: (
    envelope: Pick<VersionDetail, 'encryptedData' | 'encryptedItemKey'>,
    vaultKey?: Uint8Array,
  ) => Promise<VaultItem>;
  encryptItem: (
    payload: VaultItem,
    vaultKey?: Uint8Array,
  ) => Promise<{
    encryptedData: { ciphertext: string; nonce: string };
    encryptedItemKey: { ciphertext: string; nonce: string };
  }>;
  wrapVaultKey: (vaultKey: Uint8Array) => Promise<{ ciphertext: string; nonce: string }>;
}

export type KeychainContextValue = Omit<KeychainSnapshot, 'masterKey'> & KeychainHelpers;

const KeychainContext = createContext<KeychainContextValue | null>(null);

function readSnapshot(): KeychainSnapshot | null {
  const s = session.get();
  if (!s?.keychain || !s.keyPair) return null;
  return buildSnapshot(s, s.keychain, s.keyPair);
}

function buildSnapshot(s: Session, keychain: Keychain, keyPair: KeyPair): KeychainSnapshot {
  return {
    masterKey: keychain.masterKey,
    vaultKey: keychain.vaultKey,
    keyPair,
    activeVaultId: s.activeVaultId,
    vaults: s.vaults,
    username: s.username,
  };
}

export function useKeychain(): KeychainContextValue {
  const value = useContext(KeychainContext);
  if (!value) throw new Error('useKeychain must be called inside <KeychainRequired>');
  return value;
}

interface Props {
  children: ReactNode;
}

export function KeychainRequired({ children }: Props) {
  const [snapshot, setSnapshot] = useState<KeychainSnapshot | null>(() => readSnapshot());

  useEffect(() => {
    return session.subscribe(() => setSnapshot(readSnapshot()));
  }, []);

  const value = useMemo<KeychainContextValue | null>(() => {
    if (!snapshot) return null;
    const helpers: KeychainHelpers = {
      getVaultKey(vaultId) {
        const entry = snapshot.vaults.get(vaultId);
        if (!entry) throw new Error(`Vault ${vaultId} not in keychain`);
        return entry.vaultKey;
      },
      async decryptItem(envelope, vaultKey) {
        const wrapKey = vaultKey ?? snapshot.vaultKey;
        const itemKey = await decryptSymmetric(
          fromBase64EncryptedValue(envelope.encryptedItemKey),
          wrapKey,
        );
        const vaultItem = await decryptVaultItem(
          fromBase64EncryptedValue(envelope.encryptedData),
          itemKey,
        );
        itemKey.fill(0);
        return {
          ...vaultItem,
          id: envelope.id,
          folderId: envelope.folderId,
          createdAt: envelope.createdAt,
          updatedAt: envelope.updatedAt,
        };
      },
      async decryptVersion(envelope, vaultKey) {
        const wrapKey = vaultKey ?? snapshot.vaultKey;
        const itemKey = await decryptSymmetric(
          fromBase64EncryptedValue(envelope.encryptedItemKey),
          wrapKey,
        );
        const vaultItem = await decryptVaultItem(
          fromBase64EncryptedValue(envelope.encryptedData),
          itemKey,
        );
        itemKey.fill(0);
        return vaultItem;
      },
      async encryptItem(payload, vaultKey) {
        const itemKey = await generateKey();
        const encryptedData = await encryptVaultItem(payload, itemKey);
        const wrapKey = vaultKey ?? snapshot.vaultKey;
        const encryptedItemKey = await encryptSymmetric(itemKey, wrapKey);
        itemKey.fill(0);
        return {
          encryptedData: toBase64EncryptedValue(encryptedData),
          encryptedItemKey: toBase64EncryptedValue(encryptedItemKey),
        };
      },
      async wrapVaultKey(vaultKey) {
        const encrypted = await encryptSymmetric(vaultKey, snapshot.masterKey);
        return toBase64EncryptedValue(encrypted);
      },
    };
    return { ...snapshot, ...helpers };
  }, [snapshot]);

  if (!value) return <Navigate to={getLastUsername() ? '/unlock' : '/login'} />;
  return <KeychainContext.Provider value={value}>{children}</KeychainContext.Provider>;
}
