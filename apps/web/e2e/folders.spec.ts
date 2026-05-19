import { test, expect } from '@playwright/test';
import {
  captureBundle,
  createVaultItem,
  registerUser,
  uniqueUsername,
  unlockVault,
} from './helpers';

const PASSWORD = 'folderstest123!';
let savedBundle: string;

test.beforeAll(async ({ browser }) => {
  test.setTimeout(90_000);
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  try {
    await registerUser(page, uniqueUsername('folders'), PASSWORD);
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

async function createFolder(page: import('@playwright/test').Page, name: string): Promise<void> {
  await page.getByRole('button', { name: 'Filter by folder' }).click();
  await page.getByTestId('create-folder-button').click();
  await page.getByTestId('new-folder-input').fill(name);
  await page.getByTestId('new-folder-input').press('Enter');
  // Sheet closes and filter switches to the new folder
  await expect(page.getByRole('button', { name: 'Filter by folder' })).toContainText(name, {
    timeout: 10_000,
  });
}

test('creates a folder and shows it in the folder filter', async ({ page }) => {
  await createFolder(page, 'Work');
  await expect(page.getByRole('button', { name: 'Filter by folder' })).toContainText('Work');
});

test('folder filter All shows all items', async ({ page }) => {
  await createVaultItem(page, 'login', 'Filter Test Item', {
    Username: 'user@example.com',
    Password: 'pass123',
  });
  await page.getByRole('link', { name: 'Vault', exact: true }).click();
  await page.waitForURL('/', { timeout: 10_000 });
  await page.getByRole('button', { name: 'Filter by folder' }).click();
  await page.getByRole('button', { name: 'All Folders' }).click();
  await expect(page.getByTestId('vault-list')).toContainText('Filter Test Item');
});

test('moves item to a folder and folder filter shows it', async ({ page }) => {
  // Create an item
  await createVaultItem(page, 'login', 'Movable Item', {
    Username: 'mover@example.com',
    Password: 'pass123',
  });
  // createVaultItem leaves us on the item detail page (list panel is off-screen); go back first
  await page.getByRole('link', { name: 'Vault', exact: true }).click();
  await page.waitForURL('/', { timeout: 10_000 });

  // Create a folder (auto-selects it; reset to All so unfiled item is visible)
  await createFolder(page, 'Personal');
  await page.getByRole('button', { name: 'Filter by folder' }).click();
  await page.getByRole('button', { name: 'All Folders' }).click();

  // Click the item to open detail view
  await page.getByTestId('vault-list').getByText('Movable Item', { exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Movable Item' })).toBeVisible({
    timeout: 10_000,
  });

  // Open the folder popover and select Personal
  await page.getByTestId('move-folder-trigger').click();
  await page
    .getByTestId('folder-popover-content')
    .getByRole('button', { name: 'Personal' })
    .click();

  // Wait for move to complete (popover closes)
  await expect(page.getByTestId('move-folder-trigger')).toContainText('Personal', {
    timeout: 10_000,
  });

  // Navigate back so the list panel is visible, then filter by Personal folder
  await page.getByRole('link', { name: 'Vault', exact: true }).click();
  await page.waitForURL('/', { timeout: 10_000 });
  await page.getByRole('button', { name: 'Filter by folder' }).click();
  await page.getByRole('button', { name: 'Personal', exact: true }).click();
  await expect(page.getByTestId('vault-list')).toContainText('Movable Item', { timeout: 10_000 });
});

test('renames a folder', async ({ page }) => {
  await createFolder(page, 'OldName');

  // Open the folder picker to access folder options
  await page.getByRole('button', { name: 'Filter by folder' }).click();

  // Open the options dropdown; use dispatchEvent to activate Rename — bypasses the
  // pointer-event hit-test conflict between the base-ui portal and the Vaul Drawer.
  await page.getByRole('button', { name: /Options for OldName/i }).click();
  await page.getByRole('menuitem', { name: 'Rename' }).dispatchEvent('click');

  // Find the rename input and change the name
  const renameInput = page.locator('[data-testid^="rename-folder-input-"]');
  await renameInput.clear();
  await renameInput.fill('NewName');
  await renameInput.press('Enter');

  await expect(page.getByRole('button', { name: 'NewName', exact: true })).toBeVisible({
    timeout: 10_000,
  });
  await expect(page.getByRole('button', { name: 'OldName', exact: true })).toHaveCount(0, {
    timeout: 5_000,
  });
});

test('deletes a folder and its items appear in All', async ({ page }) => {
  // Create folder (auto-selects it; new item link will carry folderId)
  await createFolder(page, 'ToDelete');

  // Create item — gets created in ToDelete folder because folderId is in URL
  await createVaultItem(page, 'login', 'WillBeOrphaned', {
    Username: 'orphan@example.com',
    Password: 'pass123',
  });

  // createVaultItem leaves us on the item detail page — no need to click into it again
  await expect(page.getByRole('heading', { name: 'WillBeOrphaned' })).toBeVisible({
    timeout: 10_000,
  });

  // Confirm item is in ToDelete (or re-assign to ensure state is correct)
  await page.getByTestId('move-folder-trigger').click();
  await page
    .getByTestId('folder-popover-content')
    .getByRole('button', { name: 'ToDelete' })
    .click();
  await expect(page.getByTestId('move-folder-trigger')).toContainText('ToDelete', {
    timeout: 10_000,
  });

  // Navigate back to vault list
  await page.getByRole('link', { name: 'Vault' }).first().click();
  await page.waitForURL('/', { timeout: 10_000 });

  // Open the folder picker and delete the folder
  await page.getByRole('button', { name: 'Filter by folder' }).click();
  await page.getByRole('button', { name: /Options for ToDelete/i }).click();
  await page.getByRole('menuitem', { name: 'Delete' }).dispatchEvent('click');

  // Confirm the deletion in the confirmation dialog; use dispatchEvent to bypass the
  // Vaul drawer overlay from the folder picker which intercepts pointer events.
  await page.getByRole('button', { name: 'Delete' }).dispatchEvent('click');

  // Folder should be gone from the picker
  await expect(page.getByRole('button', { name: 'ToDelete', exact: true })).toHaveCount(0, {
    timeout: 10_000,
  });

  // Reset to All Folders (closes picker)
  await page.getByRole('button', { name: 'All Folders' }).click();

  // Item should still appear under All
  await expect(page.getByTestId('vault-list')).toContainText('WillBeOrphaned', {
    timeout: 10_000,
  });
});

test('removes item from folder (move to No folder)', async ({ page }) => {
  // createFolder auto-selects Removable; createVaultItem gets folderId from URL
  await createFolder(page, 'Removable');
  await createVaultItem(page, 'login', 'InFolder', {
    Username: 'infolder@example.com',
    Password: 'pass123',
  });

  // createVaultItem lands on the item detail page — vault-list is off-screen, no need to click
  await expect(page.getByTestId('move-folder-trigger')).toContainText('Removable', {
    timeout: 10_000,
  });

  // Remove from folder
  await page.getByTestId('move-folder-trigger').click();
  await page.getByTestId('move-folder-none').click();
  await expect(page.getByTestId('move-folder-trigger')).toContainText('No folder', {
    timeout: 10_000,
  });
});
