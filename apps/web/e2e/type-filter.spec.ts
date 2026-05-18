import { test, expect } from '@playwright/test';
import {
  captureBundle,
  createVault,
  createVaultItem,
  registerUser,
  uniqueUsername,
  unlockVault,
} from './helpers';

const PASSWORD = 'typefiltertest123!';
let savedBundle: string;

test.beforeAll(async ({ browser }) => {
  test.setTimeout(120_000);
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  try {
    await registerUser(page, uniqueUsername('typef'), PASSWORD);
    await createVaultItem(page, 'login', 'Alpha Login', {
      Username: 'alpha@example.com',
      Password: 'pass123',
    });
    await createVaultItem(page, 'secure_note', 'My Note', {
      Content: 'some secret',
    });
    savedBundle = await captureBundle(page);
  } finally {
    await ctx.close();
  }
  expect(savedBundle, 'User registration must succeed').toBeTruthy();
});

test.beforeEach(async ({ page }) => {
  test.setTimeout(60_000);
  await unlockVault(page, savedBundle, PASSWORD);
});

test('shows only matching items when a type is selected', async ({ page }) => {
  await page.getByRole('button', { name: 'Filter by type' }).click();
  await page.getByRole('button', { name: 'Logins' }).click();

  const list = page.getByTestId('vault-list');
  await expect(list).toContainText('Alpha Login');
  await expect(list).not.toContainText('My Note');
  await expect(page.getByRole('button', { name: 'Filter by type' })).toContainText('Logins');
});

test('resets to All Types and shows all items', async ({ page }) => {
  await page.getByRole('button', { name: 'Filter by type' }).click();
  await page.getByRole('button', { name: 'Logins' }).click();

  await page.getByRole('button', { name: 'Filter by type' }).click();
  await page.getByRole('button', { name: 'All Types' }).click();

  const list = page.getByTestId('vault-list');
  await expect(list).toContainText('Alpha Login');
  await expect(list).toContainText('My Note');
});

test('type filter persists after page reload', async ({ page }) => {
  await page.getByRole('button', { name: 'Filter by type' }).click();
  await page.getByRole('button', { name: 'Logins' }).click();

  const stored = await page.evaluate(() => localStorage.getItem('bp:vault:typeFilter'));
  expect(stored).toBe('login');

  await page.reload();
  await page.waitForURL(/\/unlock/, { timeout: 15_000 });
  await page.getByLabel('Master password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Unlock vault' }).click();
  await page.waitForURL('/', { timeout: 30_000 });

  await expect(page.getByRole('button', { name: 'Filter by type' })).toContainText('Logins', {
    timeout: 10_000,
  });
});

test('type filter resets to All Types after vault switch', async ({ page }) => {
  await page.getByRole('button', { name: 'Filter by type' }).click();
  await page.getByRole('button', { name: 'Logins' }).click();
  await expect(page.getByRole('button', { name: 'Filter by type' })).toContainText('Logins');

  await createVault(page, 'Work Vault');

  await expect(page.getByRole('button', { name: 'Filter by type' })).toContainText('All Types', {
    timeout: 10_000,
  });
});
