import { test, expect } from '@playwright/test';
import {
  captureBundle,
  createVault,
  createVaultItem,
  registerUser,
  uniqueUsername,
  unlockVault,
} from './helpers';

const PASSWORD = 'searchtest123!';
let savedBundle: string;

test.beforeAll(async ({ browser }) => {
  test.setTimeout(240_000);
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  try {
    // Register → lands on My Vault at '/', which ends with '/' so createVault
    // won't trigger a page.goto reload.
    await registerUser(page, uniqueUsername('search'), PASSWORD);

    // Create Work Vault (switches active vault to Work Vault).
    await createVault(page, 'Work Vault');

    // Switch back to My Vault via the picker — SPA update, no page reload.
    await page.getByTestId('vault-picker-trigger').click();
    await page.getByRole('button', { name: 'My Vault', exact: true }).click();
    await expect(page.getByTestId('vault-picker-trigger')).toHaveAttribute(
      'data-active-vault',
      'My Vault',
      {
        timeout: 5_000,
      },
    );

    // Create Alpha Login in My Vault.
    await createVaultItem(page, 'login', 'Alpha Login', {
      Username: 'alpha@example.com',
      Password: 'alpha123',
    });

    // createVaultItem leaves us on the item detail page where the list panel
    // is off-screen (mobile layout). Navigate back to vault list before switching vaults.
    await page.getByRole('link', { name: 'Vault', exact: true }).click();
    await page.waitForURL('/', { timeout: 10_000 });

    // Switch to Work Vault.
    await page.getByTestId('vault-picker-trigger').click();
    await page.getByRole('button', { name: 'Work Vault', exact: true }).click();
    await expect(page.getByTestId('vault-picker-trigger')).toHaveAttribute(
      'data-active-vault',
      'Work Vault',
      {
        timeout: 5_000,
      },
    );

    // Create Beta Login in Work Vault.
    await createVaultItem(page, 'login', 'Beta Login', {
      Username: 'beta@example.com',
      Password: 'beta456',
    });

    savedBundle = await captureBundle(page);
  } finally {
    await ctx.close();
  }
  expect(savedBundle).toBeTruthy();
});

test.beforeEach(async ({ page }) => {
  test.setTimeout(45_000);
  await unlockVault(page, savedBundle, PASSWORD);
  // Wait for sync to complete so all items are in the IndexedDB cache.
  await expect(page.getByTestId('sync-status-bar')).toHaveAttribute('data-sync-status', 'idle', {
    timeout: 20_000,
  });
});

test('command palette finds items from all vaults', async ({ page }) => {
  await page.getByTestId('open-command-palette').click();
  await expect(page.getByTestId('command-palette-input')).toBeVisible();

  await page.getByTestId('command-palette-input').fill('Alpha');
  await expect(
    page.locator('[data-testid^="command-row-item"]').filter({ hasText: 'Alpha Login' }),
  ).toBeVisible({ timeout: 5_000 });

  await page.getByTestId('command-palette-input').fill('Beta');
  await expect(
    page.locator('[data-testid^="command-row-item"]').filter({ hasText: 'Beta Login' }),
  ).toBeVisible({ timeout: 5_000 });
});

test('command palette shows vault name in subtitle with multiple vaults', async ({ page }) => {
  await page.getByTestId('open-command-palette').click();
  await expect(page.getByTestId('command-palette-input')).toBeVisible();

  await page.getByTestId('command-palette-input').fill('Beta Login');
  const row = page.locator('[data-testid^="command-row-item"]').filter({ hasText: 'Beta Login' });
  await expect(row).toBeVisible({ timeout: 5_000 });
  await expect(row).toContainText('Work Vault');
});

test('command palette finds items by vault name', async ({ page }) => {
  await page.getByTestId('open-command-palette').click();
  await expect(page.getByTestId('command-palette-input')).toBeVisible();

  await page.getByTestId('command-palette-input').fill('Work Vault');
  await expect(
    page.locator('[data-testid^="command-row-item"]').filter({ hasText: 'Beta Login' }),
  ).toBeVisible({ timeout: 5_000 });
});

test('command palette switches vault and displays item when selecting from another vault', async ({
  page,
}) => {
  // Unlock restores the owned vault as active, so switch to Work Vault first.
  await expect(page.getByTestId('vault-picker-trigger')).toHaveAttribute(
    'data-active-vault',
    'My Vault',
  );
  await page.getByTestId('vault-picker-trigger').click();
  await page.getByRole('button', { name: 'Work Vault', exact: true }).click();
  await expect(page.getByTestId('vault-picker-trigger')).toHaveAttribute(
    'data-active-vault',
    'Work Vault',
    {
      timeout: 5_000,
    },
  );

  await page.getByTestId('open-command-palette').click();
  await expect(page.getByTestId('command-palette-input')).toBeVisible();

  // Search for item in My Vault while Work Vault is active.
  await page.getByTestId('command-palette-input').fill('Alpha Login');
  const row = page.locator('[data-testid^="command-row-item"]').filter({ hasText: 'Alpha Login' });
  await expect(row).toBeVisible({ timeout: 5_000 });

  await row.click();

  // Item detail should be visible (still on item detail page at this point).
  await expect(page.getByRole('heading', { name: 'Alpha Login' })).toBeVisible({
    timeout: 5_000,
  });

  // Vault picker trigger label should have switched to My Vault.
  await expect(page.getByTestId('vault-picker-trigger')).toHaveAttribute(
    'data-active-vault',
    'My Vault',
    {
      timeout: 5_000,
    },
  );

  // Navigate to vault home first — vault-picker-trigger is in the list panel which is
  // off-screen on item detail pages.
  await page.getByRole('link', { name: 'Vault', exact: true }).click();
  await page.waitForURL('/', { timeout: 10_000 });

  // Open the vault picker and verify My Vault is marked as active (check icon visible).
  await page.getByTestId('vault-picker-trigger').click();
  const myVaultBtn = page
    .locator('[role="dialog"]')
    .getByRole('button', { name: 'My Vault', exact: true });
  await expect(myVaultBtn).toBeVisible();
  await expect(myVaultBtn.locator('svg').first()).not.toHaveClass(/invisible/);
  await page.keyboard.press('Escape');
});
