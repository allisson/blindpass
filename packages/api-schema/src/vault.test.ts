import { describe, it, expect } from 'vitest';
import {
  OwnedVaultSchema,
  SharedVaultSchema,
  VaultSchema,
  ListVaultsResponseSchema,
  CreateVaultRequestSchema,
  UpdateVaultRequestSchema,
  VaultItemSchema,
  CreateItemRequestSchema,
  MoveItemRequestSchema,
  ItemVersionSchema,
  VersionDetailSchema,
  CreateShareRequestSchema,
  VaultShareSchema,
  TrashedItemSchema,
  GlobalTrashedItemSchema,
  VaultIdParamSchema,
  VaultItemParamSchema,
  ShareParamSchema,
  VersionParamSchema,
  UserByUsernameResponseSchema,
  BatchCreateItemsRequestSchema,
  DeltaQuerySchema,
  ListDeltaResponseSchema,
  FolderSchema,
  CreateFolderRequestSchema,
  UpdateFolderRequestSchema,
  FolderParamSchema,
  ListFoldersResponseSchema,
} from './vault.js';

const b64 = 'dGVzdA==';
const encVal = { ciphertext: b64, nonce: b64 };
const uuid = '123e4567-e89b-12d3-a456-426614174000';
const uuid2 = '223e4567-e89b-12d3-a456-426614174000';
const ts = new Date().toISOString();

const ownedBase = {
  id: uuid,
  isShared: false as const,
  encryptedVaultKey: encVal,
  encryptedVaultData: encVal,
  createdAt: ts,
  updatedAt: ts,
};

const sharedBase = {
  id: uuid,
  isShared: true as const,
  sealedVaultKey: b64,
  shareId: uuid2,
  ownerUsername: 'owner_user',
  role: 'viewer' as const,
  encryptedVaultData: encVal,
  createdAt: ts,
  updatedAt: ts,
};

describe('OwnedVaultSchema', () => {
  it('accepts valid owned vault', () => {
    expect(OwnedVaultSchema.safeParse(ownedBase).success).toBe(true);
  });

  it('rejects missing encryptedVaultKey', () => {
    expect(OwnedVaultSchema.safeParse({ ...ownedBase, encryptedVaultKey: undefined }).success).toBe(
      false,
    );
  });

  it('rejects when isShared is true', () => {
    expect(OwnedVaultSchema.safeParse({ ...ownedBase, isShared: true }).success).toBe(false);
  });

  it('rejects invalid id format', () => {
    expect(OwnedVaultSchema.safeParse({ ...ownedBase, id: 'not-a-uuid' }).success).toBe(false);
  });
});

describe('SharedVaultSchema', () => {
  it('accepts valid shared vault', () => {
    expect(SharedVaultSchema.safeParse(sharedBase).success).toBe(true);
  });

  it('rejects missing sealedVaultKey', () => {
    expect(SharedVaultSchema.safeParse({ ...sharedBase, sealedVaultKey: undefined }).success).toBe(
      false,
    );
  });

  it('rejects missing shareId', () => {
    expect(SharedVaultSchema.safeParse({ ...sharedBase, shareId: undefined }).success).toBe(false);
  });

  it('rejects invalid ownerUsername', () => {
    expect(SharedVaultSchema.safeParse({ ...sharedBase, ownerUsername: 'Not-Valid' }).success).toBe(
      false,
    );
  });

  it('rejects when isShared is false', () => {
    expect(SharedVaultSchema.safeParse({ ...sharedBase, isShared: false }).success).toBe(false);
  });
});

describe('VaultSchema (discriminated union)', () => {
  it('accepts owned vault via discriminant isShared=false', () => {
    const result = VaultSchema.safeParse(ownedBase);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.isShared).toBe(false);
  });

  it('accepts shared vault via discriminant isShared=true', () => {
    const result = VaultSchema.safeParse(sharedBase);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.isShared).toBe(true);
  });

  it('rejects vault missing isShared field', () => {
    expect(VaultSchema.safeParse({ ...ownedBase, isShared: undefined }).success).toBe(false);
  });

  it('owned vault cannot have sealedVaultKey (strips extra fields via zod default)', () => {
    const result = VaultSchema.safeParse({ ...ownedBase, sealedVaultKey: b64 });
    expect(result.success).toBe(true);
    if (result.success && !result.data.isShared) {
      expect('sealedVaultKey' in result.data).toBe(false);
    }
  });

  it('shared vault cannot satisfy owned schema without encryptedVaultKey', () => {
    expect(OwnedVaultSchema.safeParse(sharedBase).success).toBe(false);
  });
});

describe('ListVaultsResponseSchema', () => {
  it('accepts mixed vault list', () => {
    expect(
      ListVaultsResponseSchema.safeParse({
        vaults: [ownedBase, sharedBase],
        nextCursor: null,
      }).success,
    ).toBe(true);
  });

  it('accepts empty list', () => {
    expect(ListVaultsResponseSchema.safeParse({ vaults: [], nextCursor: null }).success).toBe(true);
  });

  it('rejects invalid vault in list', () => {
    expect(ListVaultsResponseSchema.safeParse({ vaults: [{ id: 'bad' }] }).success).toBe(false);
  });
});

describe('CreateVaultRequestSchema', () => {
  it('accepts valid payload', () => {
    expect(
      CreateVaultRequestSchema.safeParse({ encryptedVaultKey: encVal, encryptedVaultData: encVal })
        .success,
    ).toBe(true);
  });

  it('rejects missing encryptedVaultData', () => {
    expect(CreateVaultRequestSchema.safeParse({ encryptedVaultKey: encVal }).success).toBe(false);
  });
});

describe('UpdateVaultRequestSchema', () => {
  it('accepts encryptedVaultData only', () => {
    expect(UpdateVaultRequestSchema.safeParse({ encryptedVaultData: encVal }).success).toBe(true);
  });

  it('rejects invalid encrypted value', () => {
    expect(UpdateVaultRequestSchema.safeParse({ encryptedVaultData: 'bad' }).success).toBe(false);
  });
});

describe('VaultItemSchema', () => {
  const item = {
    id: uuid,
    encryptedData: encVal,
    encryptedItemKey: encVal,
    createdAt: ts,
    updatedAt: ts,
  };

  it('accepts valid item', () => {
    expect(VaultItemSchema.safeParse(item).success).toBe(true);
  });

  it('rejects missing encryptedItemKey', () => {
    expect(VaultItemSchema.safeParse({ ...item, encryptedItemKey: undefined }).success).toBe(false);
  });

  it('rejects non-uuid id', () => {
    expect(VaultItemSchema.safeParse({ ...item, id: 'bad-id' }).success).toBe(false);
  });
});

describe('CreateItemRequestSchema', () => {
  it('accepts valid payload', () => {
    expect(
      CreateItemRequestSchema.safeParse({ encryptedData: encVal, encryptedItemKey: encVal })
        .success,
    ).toBe(true);
  });

  it('rejects missing field', () => {
    expect(CreateItemRequestSchema.safeParse({ encryptedData: encVal }).success).toBe(false);
  });
});

describe('ItemVersionSchema', () => {
  it('accepts valid version summary', () => {
    expect(ItemVersionSchema.safeParse({ id: uuid, versionNum: 1, createdAt: ts }).success).toBe(
      true,
    );
  });

  it('rejects non-integer versionNum', () => {
    expect(ItemVersionSchema.safeParse({ id: uuid, versionNum: 1.5, createdAt: ts }).success).toBe(
      false,
    );
  });
});

describe('VersionDetailSchema', () => {
  it('accepts full version detail', () => {
    expect(
      VersionDetailSchema.safeParse({
        id: uuid,
        versionNum: 1,
        encryptedData: encVal,
        encryptedItemKey: encVal,
        createdAt: ts,
      }).success,
    ).toBe(true);
  });

  it('rejects missing encryptedItemKey', () => {
    expect(
      VersionDetailSchema.safeParse({
        id: uuid,
        versionNum: 1,
        encryptedData: encVal,
        createdAt: ts,
      }).success,
    ).toBe(false);
  });
});

describe('CreateShareRequestSchema', () => {
  it('accepts valid share request', () => {
    expect(
      CreateShareRequestSchema.safeParse({ receiverUserId: uuid, sealedVaultKey: b64 }).success,
    ).toBe(true);
  });

  it('rejects non-uuid receiverUserId', () => {
    expect(
      CreateShareRequestSchema.safeParse({ receiverUserId: 'bad', sealedVaultKey: b64 }).success,
    ).toBe(false);
  });

  it('rejects non-base64 sealedVaultKey', () => {
    expect(
      CreateShareRequestSchema.safeParse({ receiverUserId: uuid, sealedVaultKey: 'bad!' }).success,
    ).toBe(false);
  });
});

describe('VaultShareSchema', () => {
  it('accepts valid share', () => {
    expect(
      VaultShareSchema.safeParse({
        id: uuid,
        receiverUserId: uuid2,
        receiverUsername: 'receiver_user',
        role: 'viewer',
        createdAt: ts,
      }).success,
    ).toBe(true);
  });

  it('rejects invalid receiverUsername', () => {
    expect(
      VaultShareSchema.safeParse({
        id: uuid,
        receiverUserId: uuid2,
        receiverUsername: 'Bad-User',
        role: 'viewer',
        createdAt: ts,
      }).success,
    ).toBe(false);
  });
});

describe('TrashedItemSchema', () => {
  it('accepts trashed item with deletedAt', () => {
    expect(
      TrashedItemSchema.safeParse({
        id: uuid,
        encryptedData: encVal,
        encryptedItemKey: encVal,
        createdAt: ts,
        updatedAt: ts,
        deletedAt: ts,
      }).success,
    ).toBe(true);
  });

  it('rejects missing deletedAt', () => {
    expect(
      TrashedItemSchema.safeParse({
        id: uuid,
        encryptedData: encVal,
        encryptedItemKey: encVal,
        createdAt: ts,
        updatedAt: ts,
      }).success,
    ).toBe(false);
  });
});

describe('GlobalTrashedItemSchema', () => {
  it('accepts global trashed item with vaultId', () => {
    expect(
      GlobalTrashedItemSchema.safeParse({
        id: uuid,
        encryptedData: encVal,
        encryptedItemKey: encVal,
        createdAt: ts,
        updatedAt: ts,
        deletedAt: ts,
        vaultId: uuid2,
      }).success,
    ).toBe(true);
  });

  it('rejects missing vaultId', () => {
    expect(
      GlobalTrashedItemSchema.safeParse({
        id: uuid,
        encryptedData: encVal,
        encryptedItemKey: encVal,
        createdAt: ts,
        updatedAt: ts,
        deletedAt: ts,
      }).success,
    ).toBe(false);
  });
});

describe('Param schemas', () => {
  it('VaultIdParamSchema accepts valid vaultId', () => {
    expect(VaultIdParamSchema.safeParse({ vaultId: uuid }).success).toBe(true);
  });

  it('VaultIdParamSchema rejects non-uuid', () => {
    expect(VaultIdParamSchema.safeParse({ vaultId: 'bad' }).success).toBe(false);
  });

  it('VaultItemParamSchema accepts vaultId + id', () => {
    expect(VaultItemParamSchema.safeParse({ vaultId: uuid, id: uuid2 }).success).toBe(true);
  });

  it('ShareParamSchema accepts vaultId + shareId', () => {
    expect(ShareParamSchema.safeParse({ vaultId: uuid, shareId: uuid2 }).success).toBe(true);
  });

  it('VersionParamSchema accepts vaultId + id + versionId', () => {
    expect(
      VersionParamSchema.safeParse({ vaultId: uuid, id: uuid2, versionId: uuid }).success,
    ).toBe(true);
  });

  it('VersionParamSchema rejects missing versionId', () => {
    expect(VersionParamSchema.safeParse({ vaultId: uuid, id: uuid2 }).success).toBe(false);
  });
});

describe('UserByUsernameResponseSchema', () => {
  it('accepts valid response', () => {
    expect(
      UserByUsernameResponseSchema.safeParse({ userId: uuid, publicKey: 'pubkey' }).success,
    ).toBe(true);
  });

  it('rejects non-uuid userId', () => {
    expect(
      UserByUsernameResponseSchema.safeParse({ userId: 'bad', publicKey: 'pubkey' }).success,
    ).toBe(false);
  });
});

describe('BatchCreateItemsRequestSchema', () => {
  const item = { encryptedData: encVal, encryptedItemKey: encVal };

  it('accepts a valid batch of items', () => {
    expect(BatchCreateItemsRequestSchema.safeParse({ items: [item, item] }).success).toBe(true);
  });

  it('rejects empty items array', () => {
    expect(BatchCreateItemsRequestSchema.safeParse({ items: [] }).success).toBe(false);
  });

  it('rejects items array exceeding 1000', () => {
    expect(
      BatchCreateItemsRequestSchema.safeParse({
        items: Array.from({ length: 1001 }, () => item),
      }).success,
    ).toBe(false);
  });

  it('accepts exactly 1000 items', () => {
    expect(
      BatchCreateItemsRequestSchema.safeParse({
        items: Array.from({ length: 1000 }, () => item),
      }).success,
    ).toBe(true);
  });

  it('rejects item missing encryptedItemKey', () => {
    expect(
      BatchCreateItemsRequestSchema.safeParse({ items: [{ encryptedData: encVal }] }).success,
    ).toBe(false);
  });
});

describe('VaultItemSchema folderId', () => {
  const base = {
    id: uuid,
    encryptedData: encVal,
    encryptedItemKey: encVal,
    createdAt: ts,
    updatedAt: ts,
  };

  it('accepts item with folderId null', () => {
    expect(VaultItemSchema.safeParse({ ...base, folderId: null }).success).toBe(true);
  });

  it('accepts item with folderId as uuid', () => {
    expect(VaultItemSchema.safeParse({ ...base, folderId: uuid2 }).success).toBe(true);
  });

  it('accepts item without folderId (optional)', () => {
    expect(VaultItemSchema.safeParse(base).success).toBe(true);
  });

  it('rejects item with non-uuid folderId', () => {
    expect(VaultItemSchema.safeParse({ ...base, folderId: 'bad-id' }).success).toBe(false);
  });
});

describe('CreateItemRequestSchema folderId', () => {
  const base = { encryptedData: encVal, encryptedItemKey: encVal };

  it('accepts request with folderId', () => {
    expect(CreateItemRequestSchema.safeParse({ ...base, folderId: uuid }).success).toBe(true);
  });

  it('accepts request without folderId', () => {
    expect(CreateItemRequestSchema.safeParse(base).success).toBe(true);
  });

  it('accepts request with folderId null', () => {
    expect(CreateItemRequestSchema.safeParse({ ...base, folderId: null }).success).toBe(true);
  });
});

describe('MoveItemRequestSchema', () => {
  it('accepts folderId as uuid', () => {
    expect(MoveItemRequestSchema.safeParse({ folderId: uuid }).success).toBe(true);
  });

  it('accepts folderId as null', () => {
    expect(MoveItemRequestSchema.safeParse({ folderId: null }).success).toBe(true);
  });

  it('rejects missing folderId', () => {
    expect(MoveItemRequestSchema.safeParse({}).success).toBe(false);
  });
});

describe('FolderSchema', () => {
  const folder = { id: uuid, encryptedName: encVal, createdAt: ts, updatedAt: ts };

  it('accepts valid folder', () => {
    expect(FolderSchema.safeParse(folder).success).toBe(true);
  });

  it('rejects missing encryptedName', () => {
    expect(FolderSchema.safeParse({ ...folder, encryptedName: undefined }).success).toBe(false);
  });

  it('rejects non-uuid id', () => {
    expect(FolderSchema.safeParse({ ...folder, id: 'bad' }).success).toBe(false);
  });
});

describe('CreateFolderRequestSchema', () => {
  it('accepts valid payload', () => {
    expect(CreateFolderRequestSchema.safeParse({ encryptedName: encVal }).success).toBe(true);
  });

  it('rejects missing encryptedName', () => {
    expect(CreateFolderRequestSchema.safeParse({}).success).toBe(false);
  });
});

describe('UpdateFolderRequestSchema', () => {
  it('accepts valid payload', () => {
    expect(UpdateFolderRequestSchema.safeParse({ encryptedName: encVal }).success).toBe(true);
  });
});

describe('FolderParamSchema', () => {
  it('accepts valid vaultId and folderId', () => {
    expect(FolderParamSchema.safeParse({ vaultId: uuid, folderId: uuid2 }).success).toBe(true);
  });

  it('rejects non-uuid folderId', () => {
    expect(FolderParamSchema.safeParse({ vaultId: uuid, folderId: 'bad' }).success).toBe(false);
  });
});

describe('ListFoldersResponseSchema', () => {
  it('accepts empty folder list', () => {
    expect(ListFoldersResponseSchema.safeParse({ folders: [] }).success).toBe(true);
  });

  it('accepts folder list with items', () => {
    const folder = { id: uuid, encryptedName: encVal, createdAt: ts, updatedAt: ts };
    expect(ListFoldersResponseSchema.safeParse({ folders: [folder] }).success).toBe(true);
  });
});

describe('DeltaQuerySchema', () => {
  it('accepts valid ISO datetime', () => {
    expect(DeltaQuerySchema.safeParse({ updatedAfter: '2024-01-01T00:00:00.000Z' }).success).toBe(
      true,
    );
  });

  it('rejects non-datetime string', () => {
    expect(DeltaQuerySchema.safeParse({ updatedAfter: 'not-a-date' }).success).toBe(false);
  });

  it('rejects missing updatedAfter', () => {
    expect(DeltaQuerySchema.safeParse({}).success).toBe(false);
  });
});

describe('ListDeltaResponseSchema', () => {
  const item = {
    id: uuid,
    encryptedData: encVal,
    encryptedItemKey: encVal,
    createdAt: ts,
    updatedAt: ts,
  };

  it('accepts valid delta response', () => {
    expect(
      ListDeltaResponseSchema.safeParse({
        items: [item],
        deletedIds: [uuid2],
        serverTime: ts,
      }).success,
    ).toBe(true);
  });

  it('accepts empty items and deletedIds', () => {
    expect(
      ListDeltaResponseSchema.safeParse({ items: [], deletedIds: [], serverTime: ts }).success,
    ).toBe(true);
  });

  it('rejects non-uuid in deletedIds', () => {
    expect(
      ListDeltaResponseSchema.safeParse({
        items: [],
        deletedIds: ['not-a-uuid'],
        serverTime: ts,
      }).success,
    ).toBe(false);
  });

  it('rejects missing serverTime', () => {
    expect(ListDeltaResponseSchema.safeParse({ items: [], deletedIds: [] }).success).toBe(false);
  });
});
