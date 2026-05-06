import { z } from 'zod';
import { UsernameSchema } from './auth.js';

export const QUOTA_MIN = 1;
export const QUOTA_MAX = 100_000;

const QuotaSchema = z.coerce.number().int().min(QUOTA_MIN).max(QUOTA_MAX);
const NullableQuotaSchema = QuotaSchema.nullable();

export const AdminSettingsSchema = z.object({
  adminUserId: z.uuid(),
  registrationsEnabled: z.boolean(),
  defaultOwnerQuota: QuotaSchema,
  defaultVaultItemQuota: QuotaSchema,
});

export const UpdateAdminSettingsRequestSchema = z.object({
  registrationsEnabled: z.boolean().optional(),
  defaultOwnerQuota: QuotaSchema.optional(),
  defaultVaultItemQuota: QuotaSchema.optional(),
});

export const AdminUsersQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const AdminUserSchema = z.object({
  id: z.uuid(),
  username: UsernameSchema,
  verified: z.boolean(),
  revokedAt: z.string().datetime().nullable(),
  ownerQuotaOverride: NullableQuotaSchema,
  vaultItemQuotaOverride: NullableQuotaSchema,
  createdAt: z.string().datetime(),
  isAdmin: z.boolean(),
});

export const ListAdminUsersResponseSchema = z.object({
  users: z.array(AdminUserSchema),
  nextCursor: z.string().nullable(),
});

export const UpdateAdminUserRequestSchema = z.object({
  revoked: z.boolean().optional(),
  ownerQuotaOverride: NullableQuotaSchema.optional(),
  vaultItemQuotaOverride: NullableQuotaSchema.optional(),
});

export const AdminSettingsResponseSchema = z.object({ settings: AdminSettingsSchema });
export const AdminStatusResponseSchema = z.object({ isAdmin: z.boolean() });

export type AdminSettings = z.infer<typeof AdminSettingsSchema>;
export type AdminSettingsResponse = z.infer<typeof AdminSettingsResponseSchema>;
export type UpdateAdminSettingsRequest = z.infer<typeof UpdateAdminSettingsRequestSchema>;
export type AdminUser = z.infer<typeof AdminUserSchema>;
export type ListAdminUsersResponse = z.infer<typeof ListAdminUsersResponseSchema>;
export type UpdateAdminUserRequest = z.infer<typeof UpdateAdminUserRequestSchema>;
export type AdminStatusResponse = z.infer<typeof AdminStatusResponseSchema>;
