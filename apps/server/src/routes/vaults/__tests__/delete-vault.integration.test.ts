import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type Fastify from 'fastify';
import { buildIntegrationApp } from '../../../test/build-app.integration.js';
import { resetDatabase } from '../../../test/reset-db.integration.js';
import { registerAndLogin, uniqueUsername } from '../../../test/auth-helpers.js';

const apps: ReturnType<typeof Fastify>[] = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

beforeEach(async () => {
  await resetDatabase();
});

const dummyVaultPayload = {
  encryptedVaultKey: {
    ciphertext: Buffer.from('vk').toString('base64'),
    nonce: Buffer.from('vn').toString('base64'),
  },
  encryptedVaultData: {
    ciphertext: Buffer.from('vd').toString('base64'),
    nonce: Buffer.from('vdn').toString('base64'),
  },
};

async function createVault(app: ReturnType<typeof Fastify>, token: string): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: '/vaults',
    headers: { authorization: `Bearer ${token}` },
    body: dummyVaultPayload,
  });
  return (res.json() as { vault: { id: string } }).vault.id;
}

async function getVaultIds(app: ReturnType<typeof Fastify>, token: string): Promise<string[]> {
  const res = await app.inject({
    method: 'GET',
    url: '/vaults',
    headers: { authorization: `Bearer ${token}` },
  });
  return (res.json() as { vaults: { id: string }[] }).vaults.map((v) => v.id);
}

async function getOwnedVaultIds(app: ReturnType<typeof Fastify>, token: string): Promise<string[]> {
  const res = await app.inject({
    method: 'GET',
    url: '/vaults',
    headers: { authorization: `Bearer ${token}` },
  });
  return (res.json() as { vaults: { id: string; isShared: boolean }[] }).vaults
    .filter((v) => !v.isShared)
    .map((v) => v.id);
}

describe('DELETE /vaults/:vaultId', () => {
  it('removes the vault from the owner list', async () => {
    const app = await buildIntegrationApp();
    apps.push(app);
    const token = await registerAndLogin(app);
    const secondId = await createVault(app, token);

    const res = await app.inject({
      method: 'DELETE',
      url: `/vaults/${secondId}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(204);

    const remaining = await getOwnedVaultIds(app, token);
    expect(remaining).not.toContain(secondId);
  });

  it('cascades the share — receiver loses access after vault deletion', async () => {
    const app = await buildIntegrationApp();
    apps.push(app);
    const ownerUsername = uniqueUsername();
    const receiverUsername = uniqueUsername();
    const ownerToken = await registerAndLogin(app, ownerUsername);
    const receiverToken = await registerAndLogin(app, receiverUsername);

    const secondId = await createVault(app, ownerToken);

    const lookupRes = await app.inject({
      method: 'GET',
      url: `/users/by-username?username=${receiverUsername}`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    const { userId: receiverUserId } = lookupRes.json() as { userId: string };

    await app.inject({
      method: 'POST',
      url: `/vaults/${secondId}/shares`,
      headers: { authorization: `Bearer ${ownerToken}` },
      body: {
        receiverUserId,
        sealedVaultKey: Buffer.from('sealed').toString('base64'),
        role: 'viewer',
      },
    });

    expect(await getVaultIds(app, receiverToken)).toContain(secondId);

    const deleteRes = await app.inject({
      method: 'DELETE',
      url: `/vaults/${secondId}`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    expect(deleteRes.statusCode).toBe(204);

    expect(await getVaultIds(app, receiverToken)).not.toContain(secondId);
  });

  it('returns 422 when the vault is the owner last vault', async () => {
    const app = await buildIntegrationApp();
    apps.push(app);
    const token = await registerAndLogin(app);
    const [onlyVaultId] = await getOwnedVaultIds(app, token);

    const res = await app.inject({
      method: 'DELETE',
      url: `/vaults/${onlyVaultId}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(422);
  });

  it('returns 403 when a shared-vault receiver tries to delete', async () => {
    const app = await buildIntegrationApp();
    apps.push(app);
    const ownerUsername = uniqueUsername();
    const receiverUsername = uniqueUsername();
    const ownerToken = await registerAndLogin(app, ownerUsername);
    const receiverToken = await registerAndLogin(app, receiverUsername);

    const [vaultId] = await getOwnedVaultIds(app, ownerToken);

    const lookupRes = await app.inject({
      method: 'GET',
      url: `/users/by-username?username=${receiverUsername}`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    const { userId: receiverUserId } = lookupRes.json() as { userId: string };

    await app.inject({
      method: 'POST',
      url: `/vaults/${vaultId}/shares`,
      headers: { authorization: `Bearer ${ownerToken}` },
      body: {
        receiverUserId,
        sealedVaultKey: Buffer.from('sealed').toString('base64'),
        role: 'editor',
      },
    });

    const res = await app.inject({
      method: 'DELETE',
      url: `/vaults/${vaultId}`,
      headers: { authorization: `Bearer ${receiverToken}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it('returns 404 for an unknown vault', async () => {
    const app = await buildIntegrationApp();
    apps.push(app);
    const token = await registerAndLogin(app);

    const res = await app.inject({
      method: 'DELETE',
      url: '/vaults/00000000-0000-0000-0000-000000000000',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(404);
  });
});
