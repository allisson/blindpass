import { test, expect, type Page } from '@playwright/test';
import {
  captureBundle,
  createVaultItem,
  lockVault,
  openItemAndReturn,
  registerUser,
  uniqueUsername,
  unlockVault,
} from './helpers';

const PASSWORD = 'recenttest123!';
let savedBundle: string;

async function moveCurrentItemToTrash(page: Page) {
  await page.getByTestId('action-bar-more').click();
  await page.getByTestId('action-bar-delete').click();
  await expect(page.getByRole('heading', { name: 'Move to trash?' })).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Move to trash' }).click();
  await page.waitForURL('/', { timeout: 15_000 });
}

test.beforeAll(async ({ browser }) => {
  test.setTimeout(120_000);
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  try {
    await registerUser(page, uniqueUsername('recent'), PASSWORD);
    await createVaultItem(page, 'login', 'Alpha Login', {
      Username: 'alpha@example.com',
      Password: 'pass-alpha',
    });
    await createVaultItem(page, 'login', 'Beta Login', {
      Username: 'beta@example.com',
      Password: 'pass-beta',
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

test('hides section when no items have been opened yet', async ({ page }) => {
  await expect(page.getByTestId('recently-viewed-section')).toHaveCount(0);
});

test('shows recently opened item at top of list, duplicated below', async ({ page }) => {
  await openItemAndReturn(page, 'Alpha Login');

  const section = page.getByTestId('recently-viewed-section');
  await expect(section).toBeVisible();
  await expect(section.getByText('Recently Viewed')).toBeVisible();
  await expect(section.getByText('Alpha Login')).toBeVisible();

  // Duplication: still appears in the main list as well.
  await expect(page.getByTestId('vault-list').getByText('Alpha Login')).toHaveCount(2);
});

test('orders by most recent first', async ({ page }) => {
  await openItemAndReturn(page, 'Alpha Login');
  await openItemAndReturn(page, 'Beta Login');

  const section = page.getByTestId('recently-viewed-section');
  const titles = await section.locator('a').allTextContents();
  // Most recent (Beta) first, Alpha second.
  expect(titles[0]).toContain('Beta Login');
  expect(titles[1]).toContain('Alpha Login');
});

test('hides section while searching', async ({ page }) => {
  await openItemAndReturn(page, 'Alpha Login');
  await expect(page.getByTestId('recently-viewed-section')).toBeVisible();

  await page.getByPlaceholder('Search items…').fill('alpha');
  await expect(page.getByTestId('recently-viewed-section')).toHaveCount(0);

  await page.getByPlaceholder('Search items…').fill('');
  await expect(page.getByTestId('recently-viewed-section')).toBeVisible();
});

test('hides section when type filter is active', async ({ page }) => {
  await openItemAndReturn(page, 'Alpha Login');
  await expect(page.getByTestId('recently-viewed-section')).toBeVisible();

  await page.getByRole('button', { name: 'Filter by type' }).click();
  await page.getByRole('button', { name: 'Logins' }).click();
  await expect(page.getByTestId('recently-viewed-section')).toHaveCount(0);

  await page.getByRole('button', { name: 'Filter by type' }).click();
  await page.getByRole('button', { name: 'All Types' }).click();
  await expect(page.getByTestId('recently-viewed-section')).toBeVisible();
});

test('excludes deleted items silently', async ({ page }) => {
  await openItemAndReturn(page, 'Alpha Login');
  await openItemAndReturn(page, 'Beta Login');

  const section = page.getByTestId('recently-viewed-section');
  await expect(section.getByText('Beta Login')).toBeVisible();

  // Delete Beta via item detail action bar.
  await page.getByTestId('vault-list').getByText('Beta Login', { exact: true }).first().click();
  await page.waitForURL(/\/[^/]+$/, { timeout: 10_000 });
  await moveCurrentItemToTrash(page);

  // Beta is gone from the section; Alpha still there.
  await expect(section.getByText('Beta Login')).toHaveCount(0);
  await expect(section.getByText('Alpha Login')).toBeVisible();
});

test('clears recently viewed on lock', async ({ page }) => {
  await openItemAndReturn(page, 'Alpha Login');
  await expect(page.getByTestId('recently-viewed-section')).toBeVisible();

  await lockVault(page);
  await page.waitForURL(/\/unlock/, { timeout: 15_000 });
  await page.getByLabel('Master password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Unlock vault' }).click();
  await page.waitForURL('/', { timeout: 30_000 });

  await expect(page.getByTestId('recently-viewed-section')).toHaveCount(0);
});
