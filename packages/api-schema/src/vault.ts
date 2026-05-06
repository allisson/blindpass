import { z } from 'zod';
import { Base64StringSchema, EncryptedValueSchema, UsernameSchema } from './auth.js';

const VaultBaseSchema = z.object({
  id: z.uuid(),
  encryptedVaultData: EncryptedValueSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const OwnedVaultSchema = VaultBaseSchema.extend({
  isShared: z.literal(false),
  encryptedVaultKey: EncryptedValueSchema,
});

export const VaultRoleSchema = z.enum(['viewer', 'editor']);

export const SharedVaultSchema = VaultBaseSchema.extend({
  isShared: z.literal(true),
  sealedVaultKey: z.string(),
  shareId: z.uuid(),
  ownerUsername: UsernameSchema,
  role: VaultRoleSchema,
});

export const VaultSchema = z.discriminatedUnion('isShared', [OwnedVaultSchema, SharedVaultSchema]);
export const ListVaultsResponseSchema = z.object({
  vaults: z.array(VaultSchema),
  nextCursor: z.uuid().nullable(),
});
export const VaultResponseSchema = z.object({ vault: VaultSchema });

export const UserByUsernameResponseSchema = z.object({
  userId: z.uuid(),
  publicKey: z.string(),
});

export const CreateShareRequestSchema = z.object({
  receiverUserId: z.uuid(),
  sealedVaultKey: Base64StringSchema,
  role: VaultRoleSchema.default('viewer'),
});

export const VaultShareSchema = z.object({
  id: z.uuid(),
  receiverUserId: z.uuid(),
  receiverUsername: UsernameSchema,
  role: VaultRoleSchema,
  createdAt: z.string(),
});
export const ListSharesResponseSchema = z.object({
  shares: z.array(VaultShareSchema),
  nextCursor: z.uuid().nullable(),
});

export const CreateVaultRequestSchema = z.object({
  encryptedVaultKey: EncryptedValueSchema,
  encryptedVaultData: EncryptedValueSchema,
});
export const UpdateVaultRequestSchema = z.object({
  encryptedVaultData: EncryptedValueSchema,
});

export const VaultItemSchema = z.object({
  id: z.uuid(),
  encryptedData: EncryptedValueSchema,
  encryptedItemKey: EncryptedValueSchema,
  folderId: z.uuid().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export const ListItemsResponseSchema = z.object({
  items: z.array(VaultItemSchema),
  nextCursor: z.uuid().nullable(),
});

export const CreateItemRequestSchema = z.object({
  encryptedData: EncryptedValueSchema,
  encryptedItemKey: EncryptedValueSchema,
  folderId: z.uuid().nullable().optional(),
});
export const UpdateItemRequestSchema = z.object({
  encryptedData: EncryptedValueSchema,
  encryptedItemKey: EncryptedValueSchema,
});
export const MoveItemRequestSchema = z.object({
  folderId: z.uuid().nullable(),
});
export const ItemResponseSchema = z.object({ item: VaultItemSchema });

export const FolderSchema = z.object({
  id: z.uuid(),
  encryptedName: EncryptedValueSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});
export const ListFoldersResponseSchema = z.object({
  folders: z.array(FolderSchema),
});
export const FolderResponseSchema = z.object({ folder: FolderSchema });
export const CreateFolderRequestSchema = z.object({
  encryptedName: EncryptedValueSchema,
});
export const UpdateFolderRequestSchema = z.object({
  encryptedName: EncryptedValueSchema,
});
export const FolderParamSchema = z.object({
  vaultId: z.uuid(),
  folderId: z.uuid(),
});

export const ItemVersionSchema = z.object({
  id: z.uuid(),
  versionNum: z.number().int(),
  createdAt: z.string(),
});
export const VersionDetailSchema = z.object({
  id: z.uuid(),
  versionNum: z.number().int(),
  encryptedData: EncryptedValueSchema,
  encryptedItemKey: EncryptedValueSchema,
  createdAt: z.string(),
});
export const ListVersionsResponseSchema = z.object({
  versions: z.array(ItemVersionSchema),
  nextCursor: z.uuid().nullable(),
});
export const VersionResponseSchema = z.object({
  version: VersionDetailSchema,
});

export const TrashedItemSchema = VaultItemSchema.extend({
  deletedAt: z.string(),
});
export const ListTrashResponseSchema = z.object({
  items: z.array(TrashedItemSchema),
  nextCursor: z.uuid().nullable(),
});

export const GlobalTrashedItemSchema = TrashedItemSchema.extend({
  vaultId: z.uuid(),
});
export const ListGlobalTrashResponseSchema = z.object({
  items: z.array(GlobalTrashedItemSchema),
  nextCursor: z.uuid().nullable(),
});

export const VaultIdParamSchema = z.object({
  vaultId: z.uuid(),
});
export const VaultItemParamSchema = z.object({
  vaultId: z.uuid(),
  id: z.uuid(),
});
export const ShareParamSchema = z.object({
  vaultId: z.uuid(),
  shareId: z.uuid(),
});
export const VersionParamSchema = z.object({
  vaultId: z.uuid(),
  id: z.uuid(),
  versionId: z.uuid(),
});

export const BATCH_CREATE_MAX_ITEMS = 1000;

export const BatchCreateItemsRequestSchema = z.object({
  items: z.array(CreateItemRequestSchema).min(1).max(BATCH_CREATE_MAX_ITEMS),
});
export const BatchCreateItemResponseItemSchema = z.object({
  id: z.uuid(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export const BatchCreateItemsResponseSchema = z.object({
  items: z.array(BatchCreateItemResponseItemSchema),
});

export const QuotaErrorCodeSchema = z.enum(['vault_limit_reached', 'item_limit_reached']);
export const QuotaErrorResponseSchema = z.object({
  error: QuotaErrorCodeSchema,
  limit: z.number().int().nonnegative(),
  current: z.number().int().nonnegative(),
  requested: z.number().int().positive().optional(),
});

export const DeltaQuerySchema = z.object({
  updatedAfter: z.string().datetime(),
});
export const ListDeltaResponseSchema = z.object({
  items: z.array(VaultItemSchema),
  deletedIds: z.array(z.uuid()),
  serverTime: z.string(),
});

export type OwnedVault = z.infer<typeof OwnedVaultSchema>;
export type SharedVault = z.infer<typeof SharedVaultSchema>;
export type Vault = z.infer<typeof VaultSchema>;
export type ListVaultsResponse = z.infer<typeof ListVaultsResponseSchema>;
export type VaultResponse = z.infer<typeof VaultResponseSchema>;
export type UserByUsernameResponse = z.infer<typeof UserByUsernameResponseSchema>;
export type CreateShareRequest = z.infer<typeof CreateShareRequestSchema>;
export type VaultShare = z.infer<typeof VaultShareSchema>;
export type ListSharesResponse = z.infer<typeof ListSharesResponseSchema>;
export type CreateVaultRequest = z.infer<typeof CreateVaultRequestSchema>;
export type UpdateVaultRequest = z.infer<typeof UpdateVaultRequestSchema>;
export type VaultItem = z.infer<typeof VaultItemSchema>;
export type ListItemsResponse = z.infer<typeof ListItemsResponseSchema>;
export type CreateItemRequest = z.infer<typeof CreateItemRequestSchema>;
export type UpdateItemRequest = z.infer<typeof UpdateItemRequestSchema>;
export type MoveItemRequest = z.infer<typeof MoveItemRequestSchema>;
export type ItemResponse = z.infer<typeof ItemResponseSchema>;
export type Folder = z.infer<typeof FolderSchema>;
export type ListFoldersResponse = z.infer<typeof ListFoldersResponseSchema>;
export type FolderResponse = z.infer<typeof FolderResponseSchema>;
export type CreateFolderRequest = z.infer<typeof CreateFolderRequestSchema>;
export type UpdateFolderRequest = z.infer<typeof UpdateFolderRequestSchema>;
export type ItemVersion = z.infer<typeof ItemVersionSchema>;
export type VersionDetail = z.infer<typeof VersionDetailSchema>;
export type ListVersionsResponse = z.infer<typeof ListVersionsResponseSchema>;
export type VersionResponse = z.infer<typeof VersionResponseSchema>;
export type TrashedItem = z.infer<typeof TrashedItemSchema>;
export type ListTrashResponse = z.infer<typeof ListTrashResponseSchema>;
export type GlobalTrashedItem = z.infer<typeof GlobalTrashedItemSchema>;
export type ListGlobalTrashResponse = z.infer<typeof ListGlobalTrashResponseSchema>;
export type BatchCreateItemsRequest = z.infer<typeof BatchCreateItemsRequestSchema>;
export type BatchCreateItemsResponse = z.infer<typeof BatchCreateItemsResponseSchema>;
export type QuotaErrorCode = z.infer<typeof QuotaErrorCodeSchema>;
export type QuotaErrorResponse = z.infer<typeof QuotaErrorResponseSchema>;
export type DeltaQuery = z.infer<typeof DeltaQuerySchema>;
export type ListDeltaResponse = z.infer<typeof ListDeltaResponseSchema>;
