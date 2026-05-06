import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type Fastify from 'fastify';
import { buildIntegrationApp } from '../../../test/build-app.integration.js';
import { resetDatabase } from '../../../test/reset-db.integration.js';
import { setupTestUser, uniqueUsername } from '../../../test/auth-helpers.js';

const apps: ReturnType<typeof Fastify>[] = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

beforeEach(async () => {
  await resetDatabase();
});

describe('GET /user/keys', () => {
  it('returns the stored key blobs after registration', async () => {
    const app = await buildIntegrationApp();
    apps.push(app);
    const { authToken, registerBody } = await setupTestUser(app, uniqueUsername());

    const res = await app.inject({
      method: 'GET',
      url: '/user/keys',
      headers: { authorization: `Bearer ${authToken}` },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      kekSalt: registerBody.kekSalt,
      publicKey: registerBody.publicKey,
      encryptedMasterKey: registerBody.encryptedMasterKey,
      encryptedPrivateKey: registerBody.encryptedPrivateKey,
    });
  });
});
