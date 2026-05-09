import { test, expect, type Page } from '@playwright/test';
import { getTotpTimeRemaining } from '@blindpass/crypto';
import {
  fillAuthenticatorCode,
  loginAs,
  makeAuthenticatorCode,
  registerUser,
  uniqueUsername,
} from './helpers';

const TEST_PASSWORD = 'supersecret123!';

async function openSettings(page: Page): Promise<void> {
  // SPA link click preserves the in-memory keychain — page.goto reloads and locks the vault.
  await page
    .getByRole('link', { name: /settings/i })
    .first()
    .click();
  await page.waitForURL('/settings', { timeout: 10_000 });
}

async function openDeleteAccountPage(page: Page): Promise<void> {
  await openSettings(page);
  await page.getByRole('link', { name: 'Delete account' }).first().click();
  await page.waitForURL('/settings/delete-account', { timeout: 10_000 });
}

test.describe('Delete account flow', () => {
  test('settings page does not auto-focus the danger-zone OTP on mount', async ({ page }) => {
    test.setTimeout(60_000);
    const username = uniqueUsername('delfocus');
    const setupKey = await registerUser(page, username, TEST_PASSWORD);
    await loginAs(page, username, TEST_PASSWORD, setupKey);

    await openSettings(page);
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();

    // Regression: pre-refactor, an inline OTP input rendered inside the danger zone with
    // `autoFocus`, snapping page focus to the bottom on every settings mount.
    await expect(page.getByLabel('Digit 1 of 6')).toHaveCount(0);
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('opens dialog → cancel from consequence step closes without deleting', async ({ page }) => {
    test.setTimeout(60_000);
    const username = uniqueUsername('delcancel');
    const setupKey = await registerUser(page, username, TEST_PASSWORD);
    await loginAs(page, username, TEST_PASSWORD, setupKey);

    await openDeleteAccountPage(page);
    await page.getByRole('button', { name: /delete account/i }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(/permanently wiped/i)).toBeVisible();
    await expect(page.getByLabel('Digit 1 of 6')).toHaveCount(0);

    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);

    // Still on delete-account page, vault still unlocked.
    await expect(page).toHaveURL(/\/settings\/delete-account$/);
    await expect(page.getByRole('heading', { name: 'Delete account', level: 1 })).toBeVisible();
  });

  test('back button on OTP step returns to consequence and clears the entered code', async ({
    page,
  }) => {
    test.setTimeout(60_000);
    const username = uniqueUsername('delback');
    const setupKey = await registerUser(page, username, TEST_PASSWORD);
    await loginAs(page, username, TEST_PASSWORD, setupKey);

    await openDeleteAccountPage(page);
    await page.getByRole('button', { name: /delete account/i }).click();

    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: /i understand/i }).click();
    await expect(dialog.getByLabel('Digit 1 of 6')).toBeVisible();

    await fillAuthenticatorCode(page, '123456');
    await dialog.getByRole('button', { name: 'Back' }).click();

    // Back on consequence step.
    await expect(dialog.getByText(/permanently wiped/i)).toBeVisible();

    // Re-enter OTP step — code must be empty (not 123456 from before).
    await dialog.getByRole('button', { name: /i understand/i }).click();
    await expect(dialog.getByLabel('Digit 1 of 6')).toHaveValue('');
  });

  test('invalid OTP keeps dialog open and surfaces an error', async ({ page }) => {
    test.setTimeout(60_000);
    const username = uniqueUsername('delbadotp');
    const setupKey = await registerUser(page, username, TEST_PASSWORD);
    await loginAs(page, username, TEST_PASSWORD, setupKey);

    await openDeleteAccountPage(page);
    await page.getByRole('button', { name: /delete account/i }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: /i understand/i }).click();

    // 000000 is overwhelmingly unlikely to be the live TOTP code.
    await fillAuthenticatorCode(page, '000000');
    await dialog.getByRole('button', { name: /permanently delete/i }).click();

    // Still on delete-account page, dialog still open, OTP step still visible.
    await expect(page).toHaveURL(/\/settings\/delete-account$/);
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel('Digit 1 of 6')).toBeVisible();
  });

  test('valid OTP deletes the account and redirects to /login', async ({ page }) => {
    test.setTimeout(90_000);
    const username = uniqueUsername('delok');
    const setupKey = await registerUser(page, username, TEST_PASSWORD);
    await loginAs(page, username, TEST_PASSWORD, setupKey);

    await openDeleteAccountPage(page);
    await page.getByRole('button', { name: /delete account/i }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: /i understand/i }).click();

    // loginAs consumed the current TOTP counter — wait for the next window boundary so
    // the +30s offset code lands on a counter strictly greater than `lastUsedCounter`.
    await page.waitForTimeout(getTotpTimeRemaining(30) * 1000 + 1_000);
    await fillAuthenticatorCode(page, makeAuthenticatorCode(setupKey, 30_000));
    await dialog.getByRole('button', { name: /permanently delete/i }).click();

    await page.waitForURL('/login', { timeout: 30_000 });
  });
});
