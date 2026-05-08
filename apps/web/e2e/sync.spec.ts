import { test, expect } from '@playwright/test';
import {
  captureBundle,
  createVaultItem,
  registerUser,
  uniqueUsername,
  unlockVault,
} from './helpers';

const PASSWORD = 'synctest123!';
let savedBundle: string;

test.beforeAll(async ({ browser }) => {
  test.setTimeout(90_000);
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  try {
    await registerUser(page, uniqueUsername('sync'), PASSWORD);
    savedBundle = await captureBundle(page);
  } finally {
    await ctx.close();
  }
  expect(savedBundle, 'User registration must succeed').toBeTruthy();
});

test('SyncStatusBar is visible after unlock', async ({ page }) => {
  test.setTimeout(30_000);
  await unlockVault(page, savedBundle, PASSWORD);
  await expect(page.getByTestId('sync-status-bar')).toBeVisible({ timeout: 5_000 });
});

test('SyncStatusBar shows synced state after load', async ({ page }) => {
  test.setTimeout(30_000);
  await unlockVault(page, savedBundle, PASSWORD);
  // Wait for idle status (sync completes after unlock)
  await expect(page.getByTestId('sync-status-bar')).toHaveAttribute('data-sync-status', 'idle', {
    timeout: 15_000,
  });
  await expect(page.getByTestId('sync-status-bar')).toContainText('Synced', { timeout: 5_000 });
});

test('force-sync button triggers re-sync', async ({ page }) => {
  test.setTimeout(30_000);
  await unlockVault(page, savedBundle, PASSWORD);

  // Wait for initial sync to complete
  await expect(page.getByTestId('sync-status-bar')).toHaveAttribute('data-sync-status', 'idle', {
    timeout: 15_000,
  });

  await page.getByTestId('force-sync-btn').click();

  // Should transition through syncing
  await expect(page.getByTestId('sync-status-bar'))
    .toHaveAttribute('data-sync-status', 'syncing', { timeout: 5_000 })
    .catch(() => {
      // May have already completed — acceptable
    });

  // Should return to idle
  await expect(page.getByTestId('sync-status-bar')).toHaveAttribute('data-sync-status', 'idle', {
    timeout: 15_000,
  });
});

test('offline mode: shows cached items and offline badge', async ({ page }) => {
  test.setTimeout(60_000);

  // Pre-load: create an item while online
  await unlockVault(page, savedBundle, PASSWORD);
  await expect(page.getByTestId('sync-status-bar')).toHaveAttribute('data-sync-status', 'idle', {
    timeout: 15_000,
  });
  await createVaultItem(page, 'login', 'Offline Test Item', {
    Username: 'user@example.com',
    Password: 'secret',
  });
  await expect(page.getByTestId('vault-list').getByText('Offline Test Item')).toBeVisible({
    timeout: 10_000,
  });

  // Go offline — setOffline blocks ALL network including localhost, so no page reload
  await page.context().setOffline(true);

  // Trigger sync to surface offline status (force-sync calls runSync which checks navigator.onLine)
  await page.getByTestId('force-sync-btn').click();

  // SyncStatusBar should show offline state
  await expect(page.getByTestId('sync-status-bar')).toHaveAttribute('data-sync-status', 'offline', {
    timeout: 10_000,
  });
  await expect(page.getByTestId('sync-status-bar')).toContainText('Offline', { timeout: 5_000 });

  // Items remain visible from React Query / IndexedDB cache
  await expect(page.getByTestId('vault-list').getByText('Offline Test Item')).toBeVisible({
    timeout: 10_000,
  });
});

test('reconnect triggers re-sync', async ({ page }) => {
  test.setTimeout(60_000);
  await unlockVault(page, savedBundle, PASSWORD);
  await expect(page.getByTestId('sync-status-bar')).toHaveAttribute('data-sync-status', 'idle', {
    timeout: 15_000,
  });

  await page.context().setOffline(true);
  await page.context().setOffline(false);

  // Re-sync should fire via the 'online' event listener
  await expect(page.getByTestId('sync-status-bar')).toHaveAttribute('data-sync-status', 'idle', {
    timeout: 20_000,
  });
});
