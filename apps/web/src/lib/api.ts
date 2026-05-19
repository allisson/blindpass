import type {
  AuthSessionBundle,
  BatchCreateItemsRequest,
  BatchCreateItemsResponse,
  AdminSettingsResponse,
  AdminStatusResponse,
  ListAdminUsersResponse,
  CompleteLoginRequest,
  CompleteRecoveryRequest,
  CompleteRegistrationRequest,
  CompleteTotpRotationRequest,
  UpdateAdminSettingsRequest,
  UpdateAdminUserRequest,
  ChangePasswordRequest,
  CreateFolderRequest,
  CreateItemRequest,
  CreateShareRequest,
  CreateVaultRequest,
  DeleteAccountRequest,
  FolderResponse,
  ItemResponse,
  KeysResponse,
  ListFoldersResponse,
  ListGlobalTrashResponse,
  ListUserItemsDeltaResponse,
  ListUserItemsResponse,
  ListSessionsResponse,
  ListSharesResponse,
  ListTrashResponse,
  ListVaultsResponse,
  ListVersionsResponse,
  MoveItemRequest,
  RegisterRequest,
  RegisterResponse,
  RotateRecoveryPhraseRequest,
  StartLoginRequest,
  StartRecoveryRequest,
  StartTotpRotationRequest,
  StartTotpRotationResponse,
  UpdateFolderRequest,
  UpdateItemRequest,
  UpdateKeysRequest,
  UpdateVaultRequest,
  UserByUsernameResponse,
  VerifyRecoveryRequest,
  VerifyRecoveryResponse,
  VaultResponse,
  VersionResponse,
} from '@blindpass/api-schema';

// Empty base URL — requests go to same origin (proxied by Vite in dev, co-deployed in prod)
const BASE_URL = '';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

interface ApiErrorBody {
  error?: string;
  limit?: number;
  current?: number;
  requested?: number;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly limit?: number;
  readonly current?: number;
  readonly requested?: number;

  constructor(status: number, message: string, body?: ApiErrorBody) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = body?.error;
    this.limit = body?.limit;
    this.current = body?.current;
    this.requested = body?.requested;
  }
}

function mapApiError(status: number, body?: ApiErrorBody): string {
  const code = body?.error;
  if (
    code === 'vault_limit_reached' &&
    typeof body?.limit === 'number' &&
    typeof body?.current === 'number'
  ) {
    return `Vault limit reached (${body.current} / ${body.limit})`;
  }
  if (
    code === 'item_limit_reached' &&
    typeof body?.limit === 'number' &&
    typeof body?.current === 'number'
  ) {
    return `Item limit reached (${body.current} / ${body.limit})`;
  }
  if (status === 400) return 'Invalid request';
  if (status === 401) return 'Session expired';
  if (code === 'registrations_disabled') return 'Registrations are currently closed';
  if (status === 403) return 'Access denied';
  if (status === 404) return 'Not found';
  if (status === 409) return 'This action conflicts with another change';
  if (status === 429) return 'Too many attempts, try again later';
  if (status >= 500 && status <= 599) return 'Server error, please try again';
  return 'Request failed';
}

async function request<T = void>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (!SAFE_METHODS.has(method)) headers['x-bp-client'] = 'web';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      credentials: 'include',
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('Request timed out — check your connection', { cause: err });
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) {
    let body: ApiErrorBody | undefined;
    try {
      body = (await res.json()) as ApiErrorBody;
    } catch {
      body = undefined;
    }
    throw new ApiError(res.status, mapApiError(res.status, body), body);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  register: (body: RegisterRequest) => request<RegisterResponse>('POST', '/auth/register', body),
  completeRegistration: (body: CompleteRegistrationRequest) =>
    request<AuthSessionBundle>('POST', '/auth/register/complete', body),
  startLogin: (body: StartLoginRequest) => request<void>('POST', '/auth/login/start', body),
  completeLogin: (body: CompleteLoginRequest) =>
    request<void>('POST', '/auth/login/complete', body),
  startRecovery: (body: StartRecoveryRequest) =>
    request<void>('POST', '/auth/recovery/start', body),
  verifyRecovery: (body: VerifyRecoveryRequest) =>
    request<VerifyRecoveryResponse>('POST', '/auth/recovery/verify', body),
  completeRecovery: (body: CompleteRecoveryRequest) =>
    request<AuthSessionBundle>('POST', '/auth/recovery/complete', body),

  logout: () => request<void>('POST', '/auth/logout'),

  getKeys: () => request<KeysResponse>('GET', '/user/keys'),
  updateKeys: (body: UpdateKeysRequest) => request<void>('PUT', '/user/keys', body),

  getVault: (cursor?: string) =>
    request<ListVaultsResponse>(
      'GET',
      `/vaults${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`,
    ),
  createVault: (body: CreateVaultRequest) => request<VaultResponse>('POST', '/vaults', body),
  updateVault: (vaultId: string, body: UpdateVaultRequest) =>
    request<VaultResponse>('PUT', `/vaults/${vaultId}`, body),
  deleteVault: (vaultId: string) => request<void>('DELETE', `/vaults/${vaultId}`),

  getUserItems: (cursor?: string) =>
    request<ListUserItemsResponse>(
      'GET',
      `/user/items${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`,
    ),
  getUserItemsDelta: (updatedAfter: string) =>
    request<ListUserItemsDeltaResponse>(
      'GET',
      `/user/items?updatedAfter=${encodeURIComponent(updatedAfter)}`,
    ),
  createItem: (vaultId: string, body: CreateItemRequest) =>
    request<ItemResponse>('POST', `/vaults/${vaultId}/items`, body),
  batchCreateItems: (vaultId: string, body: BatchCreateItemsRequest) =>
    request<BatchCreateItemsResponse>('POST', `/vaults/${vaultId}/items/batch`, body),
  updateItem: (vaultId: string, id: string, body: UpdateItemRequest) =>
    request<ItemResponse>('PUT', `/vaults/${vaultId}/items/${id}`, body),
  deleteItem: (vaultId: string, id: string) =>
    request<void>('DELETE', `/vaults/${vaultId}/items/${id}`),

  getTrash: (vaultId: string, cursor?: string) =>
    request<ListTrashResponse>(
      'GET',
      `/vaults/${vaultId}/trash${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`,
    ),
  restoreItem: (vaultId: string, id: string) =>
    request<void>('POST', `/vaults/${vaultId}/trash/${id}/restore`),
  purgeItem: (vaultId: string, id: string) =>
    request<void>('DELETE', `/vaults/${vaultId}/trash/${id}`),
  emptyTrash: (vaultId: string) => request<void>('DELETE', `/vaults/${vaultId}/trash`),

  getGlobalTrash: (cursor?: string) =>
    request<ListGlobalTrashResponse>(
      'GET',
      `/user/trash${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`,
    ),
  emptyGlobalTrash: () => request<void>('DELETE', '/user/trash'),

  changePassword: (body: ChangePasswordRequest) => request<void>('PUT', '/user/password', body),
  deleteAccount: (body: DeleteAccountRequest) => request<void>('DELETE', '/user', body),
  rotateRecoveryPhrase: (body: RotateRecoveryPhraseRequest) =>
    request<void>('POST', '/user/recovery/rotate', body),
  startTotpRotation: (body: StartTotpRotationRequest) =>
    request<StartTotpRotationResponse>('POST', '/user/totp/rotate/start', body),
  completeTotpRotation: (body: CompleteTotpRotationRequest) =>
    request<void>('POST', '/user/totp/rotate/complete', body),

  getVersions: (vaultId: string, itemId: string, cursor?: string) =>
    request<ListVersionsResponse>(
      'GET',
      `/vaults/${vaultId}/items/${itemId}/versions${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`,
    ),
  getVersion: (vaultId: string, itemId: string, versionId: string) =>
    request<VersionResponse>('GET', `/vaults/${vaultId}/items/${itemId}/versions/${versionId}`),

  getSessions: () => request<ListSessionsResponse>('GET', '/auth/sessions'),
  deleteSession: (sessionId: string) => request<void>('DELETE', `/auth/sessions/${sessionId}`),
  deleteAllOtherSessions: () => request<void>('DELETE', '/auth/sessions'),

  getAdminStatus: () => request<AdminStatusResponse>('GET', '/admin/status'),
  getAdminSettings: () => request<AdminSettingsResponse>('GET', '/admin/settings'),
  updateAdminSettings: (body: UpdateAdminSettingsRequest) =>
    request<AdminSettingsResponse>('PATCH', '/admin/settings', body),
  getAdminUsers: (cursor?: string, limit = 20) => {
    const params = new URLSearchParams({ limit: String(limit) });
    if (cursor) params.set('cursor', cursor);
    return request<ListAdminUsersResponse>('GET', `/admin/users?${params.toString()}`);
  },
  updateAdminUser: (userId: string, body: UpdateAdminUserRequest) =>
    request<void>('PATCH', `/admin/users/${userId}`, body),
  deleteAdminUser: (userId: string) => request<void>('DELETE', `/admin/users/${userId}`),

  getUserByUsername: (username: string) =>
    request<UserByUsernameResponse>(
      'GET',
      `/users/by-username?username=${encodeURIComponent(username)}`,
    ),
  createShare: (vaultId: string, body: CreateShareRequest) =>
    request<void>('POST', `/vaults/${vaultId}/shares`, body),
  listShares: (vaultId: string, cursor?: string) =>
    request<ListSharesResponse>(
      'GET',
      `/vaults/${vaultId}/shares${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`,
    ),
  revokeShare: (vaultId: string, shareId: string) =>
    request<void>('DELETE', `/vaults/${vaultId}/shares/${shareId}`),

  listFolders: (vaultId: string) =>
    request<ListFoldersResponse>('GET', `/vaults/${vaultId}/folders`),
  createFolder: (vaultId: string, body: CreateFolderRequest) =>
    request<FolderResponse>('POST', `/vaults/${vaultId}/folders`, body),
  updateFolder: (vaultId: string, folderId: string, body: UpdateFolderRequest) =>
    request<FolderResponse>('PATCH', `/vaults/${vaultId}/folders/${folderId}`, body),
  deleteFolder: (vaultId: string, folderId: string) =>
    request<void>('DELETE', `/vaults/${vaultId}/folders/${folderId}`),
  moveItem: (vaultId: string, id: string, body: MoveItemRequest) =>
    request<void>('PATCH', `/vaults/${vaultId}/items/${id}/folder`, body),
};
