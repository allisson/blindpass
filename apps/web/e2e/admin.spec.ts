import { test, expect } from '@playwright/test';
import { captureBundle, registerUser, uniqueUsername, unlockVault } from './helpers';

// USERNAMEs are assigned in beforeAll. Playwright's fullyParallel mode can re-run
// beforeAll within the same worker for the same spec — module-scope assignment
// would collide on re-run. See helpers.ts uniqueUsername.
let USERNAME: string;
let MEMBER_USERNAME: string;
const PASSWORD = 'adminuitest123!';
let savedBundle: string;

test.beforeAll(async ({ browser }) => {
  test.setTimeout(90_000);
  USERNAME = uniqueUsername('admin_ui');
  MEMBER_USERNAME = uniqueUsername('member');
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  try {
    await registerUser(page, USERNAME, PASSWORD);
    savedBundle = await captureBundle(page);
  } finally {
    await ctx.close();
  }
  expect(savedBundle).toBeTruthy();
});

test.beforeEach(async ({ page }) => {
  test.setTimeout(45_000);
  await page.route('**/admin/status', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ isAdmin: true }),
    });
  });
  await unlockVault(page, savedBundle, PASSWORD);
});

test('admin dashboard edits settings and user access', async ({ page }) => {
  let registrationsEnabled = true;
  let revoked = false;
  let deleted = false;

  await page.route('**/admin/settings', async (route, request) => {
    if (request.method() === 'GET') {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          settings: {
            adminUserId: '018f6dc0-1111-7111-8111-111111111111',
            registrationsEnabled,
            defaultOwnerQuota: 10,
            defaultVaultItemQuota: 1000,
          },
        }),
      });
      return;
    }
    if (request.method() === 'PATCH') {
      const body = request.postDataJSON() as { registrationsEnabled: boolean };
      registrationsEnabled = body.registrationsEnabled;
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          settings: {
            adminUserId: '018f6dc0-1111-7111-8111-111111111111',
            registrationsEnabled,
            defaultOwnerQuota: 10,
            defaultVaultItemQuota: 1000,
          },
        }),
      });
      return;
    }
    await route.fallback();
  });

  await page.route('**/admin/users**', async (route, request) => {
    if (request.method() === 'GET') {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          users: deleted
            ? []
            : [
                {
                  id: '018f6dc0-1111-7111-8111-111111111111',
                  username: USERNAME,
                  verified: true,
                  revokedAt: null,
                  ownerQuotaOverride: null,
                  vaultItemQuotaOverride: null,
                  createdAt: new Date().toISOString(),
                  isAdmin: true,
                },
                {
                  id: '018f6dc0-2222-7222-8222-222222222222',
                  username: MEMBER_USERNAME,
                  verified: true,
                  revokedAt: revoked ? new Date().toISOString() : null,
                  ownerQuotaOverride: 3,
                  vaultItemQuotaOverride: null,
                  createdAt: new Date().toISOString(),
                  isAdmin: false,
                },
              ],
          nextCursor: null,
        }),
      });
      return;
    }
    await route.fallback();
  });

  await page.route('**/admin/users/*', async (route, request) => {
    if (request.method() === 'PATCH') {
      const body = request.postDataJSON() as { revoked?: boolean };
      if (typeof body.revoked === 'boolean') revoked = body.revoked;
      await route.fulfill({ status: 204 });
      return;
    }
    if (request.method() === 'DELETE') {
      deleted = true;
      await route.fulfill({ status: 204 });
      return;
    }
    await route.fallback();
  });

  await page.getByTestId('account-menu-trigger').click();
  await page.getByRole('link', { name: 'Admin' }).click();

  await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible();
  await expect(page.getByRole('table').getByText(MEMBER_USERNAME)).toBeVisible();
  const memberRow = page.getByRole('row').filter({ hasText: MEMBER_USERNAME });
  await expect(memberRow.getByRole('button', { name: 'Revoke' })).toBeVisible();

  await page.getByRole('checkbox', { name: 'New registrations' }).click();
  await page.getByRole('button', { name: 'Save' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click();
  await expect.poll(() => registrationsEnabled).toBe(false);

  await memberRow.getByRole('button', { name: 'Revoke' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Revoke' }).click();
  await expect(memberRow.getByRole('button', { name: 'Restore' })).toBeVisible();

  await memberRow.getByRole('button', { name: 'Restore' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Restore' }).click();
  await expect(memberRow.getByRole('button', { name: 'Revoke' })).toBeVisible();

  await memberRow.getByRole('button', { name: 'Delete' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
  await expect(memberRow).toBeHidden();
});

test('register page shows registration gate denial', async ({ page }) => {
  await page.route('**/auth/register', async (route) => {
    await route.fulfill({
      status: 403,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'registrations_disabled' }),
    });
  });

  await page.goto('/register');
  await page.getByLabel('Username').fill(uniqueUsername('closed'));
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByLabel('Confirm password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Create account' }).click();

  await expect(page.getByText('Registrations are currently closed')).toBeVisible({
    timeout: 30_000,
  });
});
