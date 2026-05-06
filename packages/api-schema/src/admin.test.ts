import { describe, expect, it } from 'vitest';
import {
  AdminSettingsResponseSchema,
  AdminUsersQuerySchema,
  ListAdminUsersResponseSchema,
  UpdateAdminSettingsRequestSchema,
  UpdateAdminUserRequestSchema,
} from './admin.js';

const uuid = '123e4567-e89b-12d3-a456-426614174000';
const ts = '2026-05-02T12:00:00.000Z';

describe('AdminSettingsResponseSchema', () => {
  it('accepts valid project settings', () => {
    expect(
      AdminSettingsResponseSchema.safeParse({
        settings: {
          adminUserId: uuid,
          registrationsEnabled: true,
          defaultOwnerQuota: 10,
          defaultVaultItemQuota: 1000,
        },
      }).success,
    ).toBe(true);
  });

  it('rejects invalid quota values', () => {
    expect(
      AdminSettingsResponseSchema.safeParse({
        settings: {
          adminUserId: uuid,
          registrationsEnabled: true,
          defaultOwnerQuota: 0,
          defaultVaultItemQuota: 100001,
        },
      }).success,
    ).toBe(false);
  });
});

describe('UpdateAdminSettingsRequestSchema', () => {
  it('accepts partial updates', () => {
    expect(
      UpdateAdminSettingsRequestSchema.safeParse({ registrationsEnabled: false }).success,
    ).toBe(true);
  });

  it('coerces quota strings', () => {
    const result = UpdateAdminSettingsRequestSchema.safeParse({ defaultOwnerQuota: '25' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.defaultOwnerQuota).toBe(25);
  });
});

describe('AdminUsersQuerySchema', () => {
  it('defaults limit', () => {
    const result = AdminUsersQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.limit).toBe(20);
  });

  it('accepts opaque cursor strings', () => {
    expect(AdminUsersQuerySchema.safeParse({ cursor: 'opaque', limit: '10' }).success).toBe(true);
  });

  it('rejects large limits', () => {
    expect(AdminUsersQuerySchema.safeParse({ limit: 101 }).success).toBe(false);
  });
});

describe('ListAdminUsersResponseSchema', () => {
  it('accepts admin user rows', () => {
    expect(
      ListAdminUsersResponseSchema.safeParse({
        users: [
          {
            id: uuid,
            username: 'blindpass_admin',
            verified: true,
            revokedAt: null,
            ownerQuotaOverride: null,
            vaultItemQuotaOverride: 50,
            createdAt: ts,
            isAdmin: true,
          },
        ],
        nextCursor: null,
      }).success,
    ).toBe(true);
  });

  it('rejects invalid revokedAt timestamps', () => {
    expect(
      ListAdminUsersResponseSchema.safeParse({
        users: [
          {
            id: uuid,
            username: 'blindpass_admin',
            verified: true,
            revokedAt: 'yesterday',
            ownerQuotaOverride: null,
            vaultItemQuotaOverride: null,
            createdAt: ts,
            isAdmin: true,
          },
        ],
        nextCursor: null,
      }).success,
    ).toBe(false);
  });
});

describe('UpdateAdminUserRequestSchema', () => {
  it('accepts revocation and nullable quota overrides', () => {
    expect(
      UpdateAdminUserRequestSchema.safeParse({
        revoked: true,
        ownerQuotaOverride: null,
        vaultItemQuotaOverride: 100,
      }).success,
    ).toBe(true);
  });

  it('rejects zero quota overrides', () => {
    expect(UpdateAdminUserRequestSchema.safeParse({ ownerQuotaOverride: 0 }).success).toBe(false);
  });
});
