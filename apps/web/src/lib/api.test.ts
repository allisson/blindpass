import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ApiError, api } from './api';

function mockFetch(status: number, body?: unknown): void {
  const response = new Response(body ? JSON.stringify(body) : null, {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response));
}

function mockFetchSequence(...responses: Response[]): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn();
  for (const response of responses) {
    fetchMock.mockResolvedValueOnce(response);
  }
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function emptyResponse(status = 204): Response {
  return new Response(null, { status });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('api error mapping', () => {
  it('maps 401 to invalid credentials', async () => {
    mockFetch(401);
    await expect(api.getKeys()).rejects.toThrow('Invalid credentials');
  });

  it('ApiError exposes status and code', () => {
    const err = new ApiError(409, 'Conflict', { error: 'Conflict' });
    expect(err.status).toBe(409);
    expect(err.code).toBe('Conflict');
  });

  it('maps quota and generic API errors', async () => {
    mockFetch(409, { error: 'vault_limit_reached', current: 5, limit: 5 });
    await expect(
      api.createVault({
        encryptedVaultKey: { ciphertext: 'YQ==', nonce: 'YQ==' },
        encryptedVaultData: { ciphertext: 'YQ==', nonce: 'YQ==' },
      }),
    ).rejects.toThrow('Vault limit reached (5 / 5)');

    mockFetch(409, { error: 'item_limit_reached', current: 10, limit: 10 });
    await expect(
      api.createItem('vault-1', {
        encryptedData: { ciphertext: 'YQ==', nonce: 'YQ==' },
        encryptedItemKey: { ciphertext: 'YQ==', nonce: 'YQ==' },
      }),
    ).rejects.toThrow('Item limit reached (10 / 10)');

    mockFetch(403, { error: 'registrations_disabled' });
    await expect(
      api.register({
        username: 'user_test',
        kekSalt: 'c2FsdA==',
        publicKey: 'cHVi',
        encryptedMasterKey: { ciphertext: 'YQ==', nonce: 'Yg==' },
        encryptedMasterKeyForRecovery: { ciphertext: 'Yw==', nonce: 'ZA==' },
        encryptedPrivateKey: { ciphertext: 'ZQ==', nonce: 'Zg==' },
        encryptedRecoveryKey: { ciphertext: 'Zw==', nonce: 'aA==' },
        encryptedVaultKey: { ciphertext: 'aQ==', nonce: 'ag==' },
        encryptedVaultData: { ciphertext: 'aw==', nonce: 'bA==' },
        recoveryVerifier: 'bW5lbW9uaWM=',
      }),
    ).rejects.toThrow('Registrations are currently closed');

    mockFetch(400, { error: 'bad_request' });
    await expect(api.startLogin({ username: 'user_test' })).rejects.toThrow('Invalid request');

    mockFetch(403, { error: 'forbidden' });
    await expect(api.getAdminStatus()).rejects.toThrow('Access denied');

    mockFetch(404, { error: 'missing' });
    await expect(api.getVersion('v1', 'i1', 'ver1')).rejects.toThrow('Not found');

    mockFetch(409, { error: 'conflict' });
    await expect(
      api.updateVault('v1', {
        encryptedVaultData: { ciphertext: 'YQ==', nonce: 'YQ==' },
      }),
    ).rejects.toThrow('Conflict');

    mockFetch(429, { error: 'rate_limited' });
    await expect(api.startRecovery({ username: 'user_test' })).rejects.toThrow(
      'Too many attempts, try again later',
    );

    mockFetch(503, { error: 'server_down' });
    await expect(api.getVault()).rejects.toThrow('Server error, please try again');

    mockFetch(418, { error: 'teapot' });
    await expect(api.getVault()).rejects.toThrow('Request failed');
  });

  it('handles non-JSON error responses and request timeouts', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('nope', { status: 500 })));
    await expect(api.getKeys()).rejects.toThrow('Server error, please try again');

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new DOMException('aborted', 'AbortError')));
    await expect(api.getKeys()).rejects.toThrow('Request timed out');

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('boom')));
    await expect(api.getKeys()).rejects.toThrow('boom');
  });
});

describe('api auth routes', () => {
  it('register POSTs to /auth/register', async () => {
    mockFetch(201, {
      enrollment: {
        enrollmentId: '550e8400-e29b-41d4-a716-446655440000',
        setupKey: 'ABCDEF123456',
        otpauthUri: 'https://example.com/otp',
        expiresAt: new Date().toISOString(),
      },
    });
    await api.register({
      username: 'user_test',
      kekSalt: 'c2FsdA==',
      publicKey: 'cHVi',
      encryptedMasterKey: { ciphertext: 'YQ==', nonce: 'Yg==' },
      encryptedMasterKeyForRecovery: { ciphertext: 'Yw==', nonce: 'ZA==' },
      encryptedPrivateKey: { ciphertext: 'ZQ==', nonce: 'Zg==' },
      encryptedRecoveryKey: { ciphertext: 'Zw==', nonce: 'aA==' },
      encryptedVaultKey: { ciphertext: 'aQ==', nonce: 'ag==' },
      encryptedVaultData: { ciphertext: 'aw==', nonce: 'bA==' },
      recoveryVerifier: 'bW5lbW9uaWM=',
    });
    const [url] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe('/auth/register');
  });

  it('completeLogin POSTs to /auth/login/complete', async () => {
    mockFetch(200, { message: 'Authenticated' });
    await api.completeLogin({ username: 'user_test', authenticatorCode: '123456' });
    const [url] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe('/auth/login/complete');
  });

  it('verifyRecovery POSTs to /auth/recovery/verify', async () => {
    mockFetch(200, {
      recoveryToken: 'token',
      enrollment: {
        enrollmentId: '550e8400-e29b-41d4-a716-446655440000',
        setupKey: 'ABCDEF123456',
        otpauthUri: 'https://example.com/otp',
        expiresAt: new Date().toISOString(),
      },
      bundle: {
        publicKey: 'pk',
        kekSalt: 'salt',
        encryptedMasterKey: { ciphertext: 'a', nonce: 'b' },
        encryptedMasterKeyForRecovery: { ciphertext: 'c', nonce: 'd' },
        encryptedPrivateKey: { ciphertext: 'e', nonce: 'f' },
        encryptedRecoveryKey: { ciphertext: 'g', nonce: 'h' },
      },
    });
    const result = await api.verifyRecovery({
      username: 'user_test',
      recoveryVerifier: 'bW5lbW9uaWM=',
    });
    const [url] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe('/auth/recovery/verify');
    expect(result.recoveryToken).toBe('token');
  });

  it('getUserByUsername encodes username in query string', async () => {
    mockFetch(200, { userId: 'user-id', publicKey: 'pk' });
    await api.getUserByUsername('user_test');
    const [url] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe('/users/by-username?username=user_test');
  });

  it('sets headers, credentials, and bodies correctly', async () => {
    mockFetch(200, { users: [], nextCursor: null });
    await api.getAdminUsers('cursor value', 10);
    let [, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(init).toMatchObject({
      method: 'GET',
      credentials: 'include',
      headers: {},
      body: undefined,
    });

    mockFetch(204);
    await api.logout();
    [, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(init).toMatchObject({
      method: 'POST',
      credentials: 'include',
      headers: { 'x-bp-client': 'web' },
      body: undefined,
    });

    mockFetch(200, { message: 'Authenticated' });
    await api.completeLogin({ username: 'user_test', authenticatorCode: '123456' });
    [, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(init).toMatchObject({
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'x-bp-client': 'web' },
      body: JSON.stringify({ username: 'user_test', authenticatorCode: '123456' }),
    });
  });

  it('covers remaining endpoint wrappers', async () => {
    const fetchMock = mockFetchSequence(
      emptyResponse(204),
      jsonResponse(200, {
        publicKey: 'YQ==',
        kekSalt: 'YQ==',
        encryptedMasterKey: { ciphertext: 'YQ==', nonce: 'YQ==' },
        encryptedMasterKeyForRecovery: { ciphertext: 'YQ==', nonce: 'YQ==' },
        encryptedPrivateKey: { ciphertext: 'YQ==', nonce: 'YQ==' },
        encryptedRecoveryKey: { ciphertext: 'YQ==', nonce: 'YQ==' },
      }),
      emptyResponse(204),
      jsonResponse(200, { id: 'vault-1', name: 'Main' }),
      jsonResponse(200, { items: [], nextCursor: null }),
      jsonResponse(200, { items: [], nextCursor: null }),
      jsonResponse(200, { id: 'item-1' }),
      jsonResponse(200, { created: [] }),
      jsonResponse(200, { id: 'item-1' }),
      emptyResponse(204),
      jsonResponse(200, { items: [], nextCursor: null }),
      emptyResponse(204),
      emptyResponse(204),
      emptyResponse(204),
      jsonResponse(200, { items: [], nextCursor: null }),
      emptyResponse(204),
      emptyResponse(204),
      emptyResponse(204),
      emptyResponse(204),
      jsonResponse(200, {
        enrollment: {
          enrollmentId: '550e8400-e29b-41d4-a716-446655440000',
          setupKey: 'YQ==',
          otpauthUri: 'https://example.com/otp',
          expiresAt: new Date().toISOString(),
        },
      }),
      emptyResponse(204),
      jsonResponse(200, { sessions: [], nextCursor: null }),
      emptyResponse(204),
      emptyResponse(204),
      jsonResponse(200, {
        settings: {
          adminUserId: '550e8400-e29b-41d4-a716-446655440000',
          registrationsEnabled: true,
          defaultOwnerQuota: 10,
          defaultVaultItemQuota: 100,
        },
      }),
      jsonResponse(200, {
        settings: {
          adminUserId: '550e8400-e29b-41d4-a716-446655440000',
          registrationsEnabled: true,
          defaultOwnerQuota: 10,
          defaultVaultItemQuota: 100,
        },
      }),
      emptyResponse(204),
      emptyResponse(204),
      emptyResponse(204),
      jsonResponse(200, { shares: [], nextCursor: null }),
      emptyResponse(204),
      jsonResponse(200, { folders: [] }),
      jsonResponse(200, { id: 'folder-1' }),
      jsonResponse(200, { id: 'folder-1' }),
      emptyResponse(204),
      emptyResponse(204),
    );

    await api.startLogin({ username: 'user_test' });
    await api.completeRegistration({
      username: 'user_test',
      enrollmentId: '550e8400-e29b-41d4-a716-446655440000',
      authenticatorCode: '123456',
    });
    await api.updateKeys({
      kekSalt: 'YQ==',
      publicKey: 'YQ==',
      encryptedMasterKey: { ciphertext: 'YQ==', nonce: 'YQ==' },
      encryptedMasterKeyForRecovery: { ciphertext: 'YQ==', nonce: 'YQ==' },
      encryptedPrivateKey: { ciphertext: 'YQ==', nonce: 'YQ==' },
      encryptedRecoveryKey: { ciphertext: 'YQ==', nonce: 'YQ==' },
    });
    await api.createVault({
      encryptedVaultKey: { ciphertext: 'YQ==', nonce: 'YQ==' },
      encryptedVaultData: { ciphertext: 'YQ==', nonce: 'YQ==' },
    });
    await api.getItems('vault-1', 'cursor value');
    await api.getItemsDelta('vault-1', '2026-05-05T00:00:00.000Z');
    await api.createItem('vault-1', {
      encryptedData: { ciphertext: 'YQ==', nonce: 'YQ==' },
      encryptedItemKey: { ciphertext: 'YQ==', nonce: 'YQ==' },
    });
    await api.batchCreateItems('vault-1', { items: [] });
    await api.updateItem('vault-1', 'item-1', {
      encryptedData: { ciphertext: 'YQ==', nonce: 'YQ==' },
      encryptedItemKey: { ciphertext: 'YQ==', nonce: 'YQ==' },
    });
    await api.deleteItem('vault-1', 'item-1');
    await api.getTrash('vault-1', 'cursor value');
    await api.restoreItem('vault-1', 'item-1');
    await api.purgeItem('vault-1', 'item-1');
    await api.emptyTrash('vault-1');
    await api.getGlobalTrash('cursor value');
    await api.emptyGlobalTrash();
    await api.changePassword({
      authenticatorCode: '123456',
      kekSalt: 'YQ==',
      encryptedMasterKey: { ciphertext: 'YQ==', nonce: 'YQ==' },
    });
    await api.deleteAccount({ authenticatorCode: '123456' });
    await api.rotateRecoveryPhrase({
      authenticatorCode: '123456',
      publicKey: 'YQ==',
      encryptedMasterKeyForRecovery: { ciphertext: 'YQ==', nonce: 'YQ==' },
      encryptedPrivateKey: { ciphertext: 'YQ==', nonce: 'YQ==' },
      encryptedRecoveryKey: { ciphertext: 'YQ==', nonce: 'YQ==' },
      recoveryVerifier: 'YQ==',
    });
    await api.startTotpRotation({ authenticatorCode: '123456' });
    await api.completeTotpRotation({
      enrollmentId: '550e8400-e29b-41d4-a716-446655440000',
      authenticatorCode: '654321',
    });
    await api.getSessions();
    await api.deleteSession('session-1');
    await api.deleteAllOtherSessions();
    await api.getAdminSettings();
    await api.updateAdminSettings({ registrationsEnabled: true });
    await api.updateAdminUser('user-1', { revoked: true });
    await api.deleteAdminUser('user-1');
    await api.createShare('vault-1', {
      receiverUserId: 'user-2',
      sealedVaultKey: 'YQ==',
      role: 'viewer',
    });
    await api.listShares('vault-1', 'cursor value');
    await api.revokeShare('vault-1', 'share-1');
    await api.listFolders('vault-1');
    await api.createFolder('vault-1', {
      encryptedName: { ciphertext: 'YQ==', nonce: 'YQ==' },
    });
    await api.updateFolder('vault-1', 'folder-1', {
      encryptedName: { ciphertext: 'YQ==', nonce: 'YQ==' },
    });
    await api.deleteFolder('vault-1', 'folder-1');
    await api.moveItem('vault-1', 'item-1', { folderId: 'folder-1' });

    expect(fetchMock).toHaveBeenCalled();
  });

  it('covers cursorless and recovery-specific GET/POST wrappers', async () => {
    const fetchMock = mockFetchSequence(
      jsonResponse(200, { vaults: [], nextCursor: null }),
      jsonResponse(200, { items: [], nextCursor: null }),
      jsonResponse(200, { items: [], nextCursor: null }),
      jsonResponse(200, { items: [], nextCursor: null }),
      jsonResponse(200, { versions: [], nextCursor: null }),
      jsonResponse(200, {
        publicKey: 'YQ==',
        kekSalt: 'YQ==',
        encryptedMasterKey: { ciphertext: 'YQ==', nonce: 'YQ==' },
        encryptedMasterKeyForRecovery: { ciphertext: 'YQ==', nonce: 'YQ==' },
        encryptedPrivateKey: { ciphertext: 'YQ==', nonce: 'YQ==' },
        encryptedRecoveryKey: { ciphertext: 'YQ==', nonce: 'YQ==' },
      }),
    );

    await api.getVault();
    await api.getItems('vault-1');
    await api.getTrash('vault-1');
    await api.getGlobalTrash();
    await api.getVersions('vault-1', 'item-1');
    await api.completeRecovery({
      username: 'user_test',
      recoveryToken: 'token',
      enrollmentId: '550e8400-e29b-41d4-a716-446655440000',
      authenticatorCode: '123456',
      kekSalt: 'YQ==',
      publicKey: 'YQ==',
      encryptedMasterKey: { ciphertext: 'YQ==', nonce: 'YQ==' },
      encryptedMasterKeyForRecovery: { ciphertext: 'YQ==', nonce: 'YQ==' },
      encryptedPrivateKey: { ciphertext: 'YQ==', nonce: 'YQ==' },
      encryptedRecoveryKey: { ciphertext: 'YQ==', nonce: 'YQ==' },
      recoveryVerifier: 'YQ==',
    });

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      '/vaults',
      '/vaults/vault-1/items',
      '/vaults/vault-1/trash',
      '/user/trash',
      '/vaults/vault-1/items/item-1/versions',
      '/auth/recovery/complete',
    ]);
  });
});
