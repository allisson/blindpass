import { test, expect } from '@playwright/test';
import {
  captureBundle,
  createVaultItem,
  registerUser,
  uniqueUsername,
  unlockVault,
} from './helpers';

const PASSWORD = 'duplicatetest123!';
let savedBundle: string;

test.beforeAll(async ({ browser }) => {
  test.setTimeout(90_000);
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  try {
    await registerUser(page, uniqueUsername('duplicate'), PASSWORD);
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

test('duplicates a login item, pre-fills the new-item form, and creates an independent copy', async ({
  page,
}) => {
  await createVaultItem(page, 'login', 'My GitHub', {
    Username: 'user@example.com',
    Password: 'hunter2',
  });
  // createVaultItem leaves us on the new item's detail page.
  await page.waitForURL(/\/[0-9a-f-]{36}$/, { timeout: 10_000 });

  // Open the overflow menu and click Duplicate.
  await page.getByTestId('action-bar-more').click();
  await page.getByTestId('action-bar-duplicate').click();

  // We land on the new-item form with duplicateFrom + type in the search params.
  await page.waitForURL(
    (url) => {
      return (
        url.pathname === '/items/new' &&
        url.searchParams.get('type') === 'login' &&
        !!url.searchParams.get('duplicateFrom')
      );
    },
    { timeout: 10_000 },
  );

  // The form is pre-populated with the source values, title suffixed with "(copy)".
  await expect(page.getByLabel('Title').and(page.locator('input, textarea'))).toHaveValue(
    'My GitHub (copy)',
  );
  await expect(page.getByLabel('Username').and(page.locator('input, textarea'))).toHaveValue(
    'user@example.com',
  );
  await expect(page.getByLabel('Password').and(page.locator('input, textarea'))).toHaveValue(
    'hunter2',
  );

  // Save as a new, independent item.
  await page.getByRole('button', { name: 'Create item' }).click();
  await page.waitForURL((url) => !url.pathname.includes('/new'), { timeout: 15_000 });

  // Both rows visible in the list — the original and the copy.
  await page.getByRole('link', { name: 'Back to vault' }).click();
  await page.waitForURL('/', { timeout: 10_000 });
  const list = page.getByTestId('vault-list');
  await expect(list.getByText('My GitHub', { exact: true }).first()).toBeVisible({
    timeout: 10_000,
  });
  await expect(list.getByText('My GitHub (copy)', { exact: true }).first()).toBeVisible({
    timeout: 10_000,
  });
});

test('cancelling the duplicate form does not create an item', async ({ page }) => {
  await createVaultItem(page, 'login', 'Acme', {
    Username: 'user@example.org',
    Password: 'topsecret',
  });
  await page.waitForURL(/\/[0-9a-f-]{36}$/, { timeout: 10_000 });

  await page.getByTestId('action-bar-more').click();
  await page.getByTestId('action-bar-duplicate').click();
  await page.waitForURL(/\/items\/new/, { timeout: 10_000 });

  await page.getByRole('button', { name: 'Cancel' }).click();
  await page.waitForURL('/', { timeout: 10_000 });

  // Only the original is in the list; no "(copy)" entry was persisted.
  const list = page.getByTestId('vault-list');
  await expect(list.getByText('Acme', { exact: true }).first()).toBeVisible({ timeout: 10_000 });
  await expect(list.getByText('Acme (copy)', { exact: true })).toHaveCount(0);
});
