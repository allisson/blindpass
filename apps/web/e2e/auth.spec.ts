import { test, expect } from '@playwright/test';
import {
  fillAuthenticatorCode,
  loginAs,
  makeAuthenticatorCode,
  readSetupKey,
  registerUser,
  uniqueUsername,
} from './helpers';

const REGISTER_USERNAME = uniqueUsername('authreg');
const LOGIN_USERNAME = uniqueUsername('authlogin');
const STORAGE_USERNAME = uniqueUsername('authstorage');
const RELOAD_USERNAME = uniqueUsername('authreload');
const TEST_PASSWORD = 'supersecret123!';
let loginSetupKey = '';
let storageSetupKey = '';
let reloadSetupKey = '';

test.describe('Register flow', () => {
  test('registers a new user and shows recovery key', async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto('/register');
    await page.getByLabel('Username').fill(REGISTER_USERNAME);
    await page.getByLabel('Password', { exact: true }).fill(TEST_PASSWORD);
    await page.getByLabel('Confirm password').fill(TEST_PASSWORD);
    await page.getByRole('button', { name: 'Create account' }).click();

    await page.waitForURL(/authenticator.*mode=register/, { timeout: 30_000 });
    await expect(page.getByText(REGISTER_USERNAME)).toBeVisible();
    await expect(page.getByText('Setup key')).toBeVisible();
    const setupKey = await readSetupKey(page);
    await fillAuthenticatorCode(page, makeAuthenticatorCode(setupKey));
    await page.getByRole('button', { name: 'Verify' }).click();

    await expect(page.getByRole('button', { name: "I've saved my recovery key" })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText('Save your recovery key')).toBeVisible();
  });
});

test.describe('Vault guard', () => {
  test('redirects unauthenticated users to /login', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL('/login');
  });

  test('redirects from /sessions to /login when unauthenticated', async ({ page }) => {
    await page.goto('/sessions');
    await expect(page).toHaveURL('/login');
  });
});

test.describe('Authenticated flows', () => {
  test.beforeAll(async ({ browser }) => {
    test.setTimeout(90_000);
    const page = await browser.newPage();
    try {
      loginSetupKey = await registerUser(page, LOGIN_USERNAME, TEST_PASSWORD);
      storageSetupKey = await registerUser(page, STORAGE_USERNAME, TEST_PASSWORD);
      reloadSetupKey = await registerUser(page, RELOAD_USERNAME, TEST_PASSWORD);
    } finally {
      await page.close();
    }
  });

  test.describe('Login flow', () => {
    test('login → OTP → vault', async ({ page }) => {
      test.setTimeout(60_000);
      await loginAs(page, LOGIN_USERNAME, TEST_PASSWORD, loginSetupKey);
      await expect(page).toHaveURL('/');
      await expect(page.getByText('Your vault is unlocked')).toBeVisible();
    });

    test('invalid OTP shows error', async ({ page }) => {
      test.setTimeout(60_000);
      await page.goto('/login');
      await page.getByLabel('Username').fill(LOGIN_USERNAME);
      await page.getByLabel('Master password').fill(TEST_PASSWORD);
      await page.getByRole('button', { name: 'Continue' }).click();

      await page.waitForURL(/authenticator.*mode=login/, { timeout: 15_000 });
      await fillAuthenticatorCode(page, '000000');
      await page.getByRole('button', { name: 'Verify' }).click();

      await expect(page.getByTestId('error-message')).toBeVisible({ timeout: 10_000 });
      await expect(page).toHaveURL(/authenticator/);
    });
  });

  test.describe('Storage security', () => {
    test('no key material in localStorage or sessionStorage after vault unlock', async ({
      page,
      context,
    }) => {
      test.setTimeout(60_000);
      await loginAs(page, STORAGE_USERNAME, TEST_PASSWORD, storageSetupKey);

      const ls = await page.evaluate(() => {
        const result: Record<string, string | null> = {};
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i)!;
          result[key] = localStorage.getItem(key);
        }
        return result;
      });
      const ss = await page.evaluate(() => JSON.stringify(sessionStorage));

      // bp:session-bundle is forbidden — it used to hold an offline brute-force verifier
      // (kekSalt + encryptedMasterKey) and a sealed auth token.
      expect(Object.keys(ls)).not.toContain('bp:session-bundle');

      // No localStorage value may smell like a key/encrypted blob.
      for (const [key, value] of Object.entries(ls)) {
        expect(key).not.toMatch(/key|token|kek|cipher|nonce|encrypted|secret/i);
        if (value) {
          expect(value).not.toMatch(/encryptedMasterKey|encryptedPrivateKey|encryptedAuthToken/);
        }
      }

      expect(ss).toBe('{}');

      // Auth token lives in an HttpOnly cookie unreachable from JS.
      const cookies = await context.cookies();
      const session = cookies.find((c) => c.name === 'bp_session');
      expect(session, 'bp_session cookie should be set after login').toBeTruthy();
      expect(session?.httpOnly).toBe(true);
      expect(session?.sameSite).toBe('Strict');
    });

    test('reload after login does not require OTP — only the master password', async ({ page }) => {
      test.setTimeout(90_000);
      await loginAs(page, RELOAD_USERNAME, TEST_PASSWORD, reloadSetupKey);

      // Drop in-memory keychain by reloading the tab.
      await page.reload();

      await page.waitForURL(/\/unlock/, { timeout: 15_000 });
      await page.getByLabel('Master password').fill(TEST_PASSWORD);
      await page.getByRole('button', { name: /Unlock vault/i }).click();

      await page.waitForURL('/', { timeout: 30_000 });
      await expect(page.getByText('Your vault is unlocked')).toBeVisible();
    });
  });
});
