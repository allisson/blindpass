import { test, expect } from '@playwright/test';
import { captureBundle, registerUser, uniqueUsername, unlockVault } from './helpers';

const USERNAME = uniqueUsername('quotas');
const PASSWORD = 'quotastest123!';
let savedBundle: string;

test.beforeAll(async ({ browser }) => {
  test.setTimeout(90_000);
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  try {
    await registerUser(page, USERNAME, PASSWORD);
    savedBundle = await captureBundle(page);
  } finally {
    await ctx.close();
  }
  expect(savedBundle, 'User registration must succeed').toBeTruthy();
});

test.beforeEach(async ({ page }) => {
  test.setTimeout(30_000);
  await unlockVault(page, savedBundle, PASSWORD);
});

test('shows quota toast when server reports vault_limit_reached', async ({ page }) => {
  await page.route('**/vaults', async (route, req) => {
    if (req.method() === 'POST') {
      await route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'vault_limit_reached', limit: 10, current: 10 }),
      });
      return;
    }
    await route.fallback();
  });

  await page.getByTestId('vault-list-heading').waitFor({ state: 'visible', timeout: 15_000 });
  await page.getByTestId('vault-picker-trigger').click();
  await page.getByTestId('new-vault-button').click();
  await page.getByTestId('new-vault-name-input').fill('Should Not Save');
  await page.getByTestId('confirm-create-vault-button').click();

  await expect(page.getByText('Vault limit reached (10 / 10)')).toBeVisible({ timeout: 10_000 });
});

test('shows quota toast when server reports item_limit_reached', async ({ page }) => {
  await page.route('**/vaults/*/items', async (route, req) => {
    if (req.method() === 'POST') {
      await route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'item_limit_reached',
          limit: 1000,
          current: 1000,
          requested: 1,
        }),
      });
      return;
    }
    await route.fallback();
  });

  await page.getByTestId('vault-list').getByLabel('New item').click();
  await page.waitForURL(/\/items\/new/, { timeout: 10_000 });
  await page.getByRole('main').getByRole('button', { name: 'Login' }).click();
  await page.waitForURL((url) => url.searchParams.get('type') === 'login', { timeout: 10_000 });

  await page.getByLabel('Title').and(page.locator('input, textarea')).fill('Quota Capped');
  await page.getByLabel('Username').and(page.locator('input, textarea')).fill('a@b.test');
  await page.getByLabel('Password').and(page.locator('input, textarea')).fill('pw');

  await page.getByRole('button', { name: 'Create item' }).click();

  await expect(page.getByText('Item limit reached (1000 / 1000)')).toBeVisible({
    timeout: 10_000,
  });
  await expect(page).toHaveURL(/\/items\/new/);
});
