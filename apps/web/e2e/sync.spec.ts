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
  await expect(page.getByTestId('vault-list').getByText('Offline Test Item').first()).toBeVisible({
    timeout: 10_000,
  });

  // Go offline — setOffline blocks ALL network including localhost, so no page reload
  await page.context().setOffline(true);

  // Wait until navigator.onLine is false before triggering sync; setOffline propagates
  // asynchronously through CDP and runSync checks navigator.onLine at the top, so
  // dispatching focus too early causes the sync to succeed before offline is detected.
  await page.waitForFunction(() => !navigator.onLine);

  // Dispatch a focus event to trigger a sync attempt; runSync sees navigator.onLine===false
  // and immediately emits 'offline' without making a network request.
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));

  // SyncStatusBar should show offline state
  await expect(page.getByTestId('sync-status-bar')).toHaveAttribute('data-sync-status', 'offline', {
    timeout: 15_000,
  });
  await expect(page.getByTestId('sync-status-bar')).toContainText('Offline', { timeout: 5_000 });

  // Items remain visible from React Query / IndexedDB cache
  await expect(page.getByTestId('vault-list').getByText('Offline Test Item').first()).toBeVisible({
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
