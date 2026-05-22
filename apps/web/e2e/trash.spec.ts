import { test, expect, type Page } from '@playwright/test';
import {
  captureBundle,
  createVaultItem,
  registerUser,
  uniqueUsername,
  unlockVault,
} from './helpers';

const PASSWORD = 'trashtest123!';
let savedBundle: string;

test.beforeAll(async ({ browser }) => {
  test.setTimeout(90_000);
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  try {
    await registerUser(page, uniqueUsername('trash'), PASSWORD);
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

async function moveCurrentItemToTrash(page: Page, title: string) {
  await page.getByTestId('action-bar-more').click();
  await page.getByTestId('action-bar-delete').click();
  await expect(page.getByRole('heading', { name: 'Move to trash?' })).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Move to trash' }).click();
  await page.waitForURL('/', { timeout: 15_000 });
  await expect(page.getByTestId('vault-list').getByText(title)).toHaveCount(0);
}

async function openTrash(page: Page) {
  await page.getByRole('link', { name: 'Trash', exact: true }).click();
  await page.waitForURL('/trash', { timeout: 10_000 });
}

test('restores, permanently deletes, searches, and empties trashed items', async ({ page }) => {
  test.setTimeout(120_000);

  const prefix = `Trash ${Date.now()}`;
  const restoreTitle = `${prefix} Restore`;
  const purgeTitle = `${prefix} Purge`;
  const searchOneTitle = `${prefix} Alpha`;
  const searchTwoTitle = `${prefix} Beta`;

  await createVaultItem(page, 'login', restoreTitle, {
    Username: 'restore@example.com',
    Password: 'secret-restore',
  });
  await moveCurrentItemToTrash(page, restoreTitle);
  await openTrash(page);
  await expect(page.getByTestId('trash-table').getByText(restoreTitle)).toBeVisible();

  await page.getByRole('button', { name: `Restore ${restoreTitle}` }).click();
  await expect(page.getByRole('heading', { name: 'Restore item?' })).toBeVisible();
  await page.getByRole('button', { name: 'Restore' }).click();
  await expect(page.getByTestId('trash-table').getByText(restoreTitle)).toHaveCount(0);
  await page.getByRole('link', { name: 'Vault' }).click();
  await expect(page.getByTestId('vault-list').getByText(restoreTitle).first()).toBeVisible({
    timeout: 10_000,
  });

  await page.getByTestId('vault-list').getByText(restoreTitle).first().click();
  await moveCurrentItemToTrash(page, restoreTitle);

  await createVaultItem(page, 'login', purgeTitle, {
    Username: 'purge@example.com',
    Password: 'secret-purge',
  });
  await moveCurrentItemToTrash(page, purgeTitle);
  await openTrash(page);
  await page.getByRole('button', { name: `Delete ${purgeTitle} permanently` }).click();
  await expect(page.getByRole('heading', { name: 'Delete permanently?' })).toBeVisible();
  await page.getByRole('button', { name: 'Delete permanently' }).click();
  await expect(page.getByTestId('trash-table').getByText(purgeTitle)).toHaveCount(0);
  await page.getByRole('link', { name: 'Vault' }).click();
  await expect(page.getByTestId('vault-list').getByText(purgeTitle)).toHaveCount(0);

  await createVaultItem(page, 'login', searchOneTitle, {
    Username: 'alpha@example.com',
    Password: 'secret-alpha',
  });
  await moveCurrentItemToTrash(page, searchOneTitle);
  await createVaultItem(page, 'login', searchTwoTitle, {
    Username: 'beta@example.com',
    Password: 'secret-beta',
  });
  await moveCurrentItemToTrash(page, searchTwoTitle);

  await openTrash(page);
  await page.getByLabel('Search trash').fill('alpha@example.com');
  await expect(page.getByTestId('trash-table').getByText(searchOneTitle)).toBeVisible();
  await expect(page.getByTestId('trash-table').getByText(searchTwoTitle)).toHaveCount(0);

  await page.getByLabel('Clear trash search').click();
  await page.getByRole('button', { name: 'Empty trash' }).click();
  await expect(page.getByRole('heading', { name: 'Empty trash?' })).toBeVisible();
  await page.getByRole('button', { name: 'Empty trash' }).click();
  await expect(page.getByText('Trash is empty')).toBeVisible({ timeout: 10_000 });
});
