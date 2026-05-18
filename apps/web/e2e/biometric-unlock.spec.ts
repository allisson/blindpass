import { test, expect, type Page } from '@playwright/test';
import {
  captureBundle,
  lockVault,
  readBiometricEnrollmentCount,
  registerUser,
  setupVirtualAuthenticator,
  uniqueUsername,
  unlockVault,
} from './helpers';

const PASSWORD = 'biometricunlock123!';
let savedBundle: string;

const ENABLE_BUTTON = /^Enable (Touch ID|Face ID|Windows Hello|biometric)$/;
const UNLOCK_BUTTON = /^Unlock with (Touch ID|Face ID|Windows Hello|biometric)$/;

async function gotoBiometricSettings(page: Page): Promise<void> {
  // SPA navigation only — page.goto would reload and lose the in-memory keychain,
  // which would redirect us to /unlock.
  await page.getByRole('link', { name: 'Settings' }).click();
  await page.waitForURL(/\/settings/, { timeout: 10_000 });
  await page
    .getByRole('navigation', { name: 'Settings' })
    .getByRole('link', { name: 'Biometric unlock' })
    .click();
  await page.waitForURL(/\/settings\/biometric-unlock/, { timeout: 10_000 });
  await expect(page.getByRole('heading', { name: 'Biometric unlock' })).toBeVisible({
    timeout: 10_000,
  });
}

async function clickEnableBiometric(page: Page): Promise<void> {
  const enable = page.getByRole('button', { name: ENABLE_BUTTON });
  await expect(enable).toBeVisible({ timeout: 10_000 });
  await expect(enable).toBeEnabled({ timeout: 10_000 });
  await enable.click();
  await expect(page.getByText('Enrolled on this device')).toBeVisible({ timeout: 15_000 });
}

test.beforeAll(async ({ browser }) => {
  test.setTimeout(120_000);
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  try {
    await registerUser(page, uniqueUsername('biometric'), PASSWORD);
    savedBundle = await captureBundle(page);
  } finally {
    await ctx.close();
  }
  expect(savedBundle, 'User registration must succeed').toBeTruthy();
});

let cleanupAuthenticator: (() => Promise<void>) | null = null;

test.beforeEach(async ({ page }) => {
  test.setTimeout(60_000);
  const { cleanup } = await setupVirtualAuthenticator(page);
  cleanupAuthenticator = cleanup;
  await unlockVault(page, savedBundle, PASSWORD);
});

test.afterEach(async () => {
  if (cleanupAuthenticator) {
    await cleanupAuthenticator();
    cleanupAuthenticator = null;
  }
});

test('enroll: writes enrollment record and shows enrolled badge', async ({ page }) => {
  await gotoBiometricSettings(page);
  await clickEnableBiometric(page);

  await expect.poll(() => readBiometricEnrollmentCount(page), { timeout: 5_000 }).toBe(1);
  await expect(page.getByRole('button', { name: 'Remove biometric unlock' })).toBeVisible();
});

test('unlock-with-biometric: lock then unlock without password entry', async ({ page }) => {
  await gotoBiometricSettings(page);
  await clickEnableBiometric(page);

  // lockVault uses the global account menu — works from settings too.
  await lockVault(page);
  await page.waitForURL(/\/unlock/, { timeout: 10_000 });

  const biometric = page.getByRole('button', { name: UNLOCK_BUTTON });
  await expect(biometric).toBeVisible({ timeout: 10_000 });
  await biometric.click();

  await page.waitForURL('/', { timeout: 30_000 });
  await expect(page.getByTestId('vault-picker-trigger')).toBeVisible({ timeout: 10_000 });
});

test('use-password-instead: fallback link reveals form and unlock works', async ({ page }) => {
  await gotoBiometricSettings(page);
  await clickEnableBiometric(page);

  // lockVault uses the global account menu — works from settings too.
  await lockVault(page);
  await page.waitForURL(/\/unlock/, { timeout: 10_000 });

  await expect(page.getByRole('button', { name: UNLOCK_BUTTON })).toBeVisible();
  await page.getByRole('button', { name: 'Use password instead' }).click();

  await page.getByLabel('Master password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Unlock vault' }).click();
  await page.waitForURL('/', { timeout: 30_000 });
  await expect(page.getByTestId('vault-picker-trigger')).toBeVisible({ timeout: 10_000 });

  // Enrollment is preserved through a password-fallback unlock
  expect(await readBiometricEnrollmentCount(page)).toBe(1);
});

test('disenroll: removes record and hides biometric button on /unlock', async ({ page }) => {
  await gotoBiometricSettings(page);
  await clickEnableBiometric(page);

  await page.getByRole('button', { name: 'Remove biometric unlock' }).click();
  await expect(page.getByRole('button', { name: ENABLE_BUTTON })).toBeVisible({ timeout: 10_000 });

  await expect.poll(() => readBiometricEnrollmentCount(page), { timeout: 5_000 }).toBe(0);

  // lockVault uses the global account menu — works from settings too.
  await lockVault(page);
  await page.waitForURL(/\/unlock/, { timeout: 10_000 });
  await expect(page.getByRole('button', { name: UNLOCK_BUTTON })).toHaveCount(0);
  await expect(page.getByLabel('Master password')).toBeVisible();
});
