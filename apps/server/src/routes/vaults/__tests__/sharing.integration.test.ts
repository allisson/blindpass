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

describe('vault sharing', () => {
  it('shares by username and exposes username metadata in responses', async () => {
    const app = await buildIntegrationApp();
    apps.push(app);
    const ownerUsername = uniqueUsername();
    const receiverUsername = uniqueUsername();
    const ownerToken = await registerAndLogin(app, ownerUsername);
    const receiverToken = await registerAndLogin(app, receiverUsername);

    const lookupRes = await app.inject({
      method: 'GET',
      url: `/users/by-username?username=${receiverUsername}`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    expect(lookupRes.statusCode).toBe(200);
    const receiver = lookupRes.json() as { userId: string };

    const vaultsRes = await app.inject({
      method: 'GET',
      url: '/vaults',
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    const vaultId = (vaultsRes.json() as { vaults: { id: string }[] }).vaults[0].id;

    const shareRes = await app.inject({
      method: 'POST',
      url: `/vaults/${vaultId}/shares`,
      headers: { authorization: `Bearer ${ownerToken}` },
      body: {
        receiverUserId: receiver.userId,
        sealedVaultKey: Buffer.from('sealed-key').toString('base64'),
        role: 'viewer',
      },
    });
    expect(shareRes.statusCode).toBe(201);
    expect(shareRes.json()).toMatchObject({
      share: {
        receiverUsername,
        role: 'viewer',
      },
    });

    const listSharesRes = await app.inject({
      method: 'GET',
      url: `/vaults/${vaultId}/shares`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    expect(listSharesRes.statusCode).toBe(200);
    expect(
      (listSharesRes.json() as { shares: { receiverUsername: string }[] }).shares[0],
    ).toMatchObject({ receiverUsername });

    const receiverVaultsRes = await app.inject({
      method: 'GET',
      url: '/vaults',
      headers: { authorization: `Bearer ${receiverToken}` },
    });
    const sharedVault = (
      receiverVaultsRes.json() as {
        vaults: { isShared: boolean; ownerUsername?: string }[];
      }
    ).vaults.find((vault) => vault.isShared);
    expect(sharedVault).toMatchObject({ ownerUsername });
  });
});
