import { test, expect } from '@playwright/test';
import { captureBundle, lockVault, registerUser, uniqueUsername, unlockVault } from './helpers';

const PASSWORD = 'locktest123!';
let savedBundle: string;

test.beforeAll(async ({ browser }) => {
  test.setTimeout(90_000);
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  try {
    await registerUser(page, uniqueUsername('lock'), PASSWORD);
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

test('lock vault button navigates to /unlock with locked heading', async ({ page }) => {
  await lockVault(page);
  await expect(page).toHaveURL('/unlock');
  await expect(page.getByText('Vault locked')).toBeVisible();
});

test('correct password on /unlock restores vault access', async ({ page }) => {
  await lockVault(page);
  await page.waitForURL('/unlock');
  await page.getByLabel('Master password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Unlock vault' }).click();
  await page.waitForURL('/', { timeout: 30_000 });
  await expect(page.getByLabel('Search vault items')).toBeVisible();
});

test('wrong password on /unlock shows error and stays locked', async ({ page }) => {
  await lockVault(page);
  await page.waitForURL('/unlock');
  await page.getByLabel('Master password').fill('wrongpassword!');
  await page.getByRole('button', { name: 'Unlock vault' }).click();
  await expect(page.getByTestId('error-message')).toBeVisible({ timeout: 15_000 });
  await expect(page).toHaveURL('/unlock');
});

test('navigating to / while locked redirects to /unlock', async ({ page }) => {
  await lockVault(page);
  await page.waitForURL('/unlock');
  await page.goto('/');
  await expect(page).toHaveURL('/unlock');
});
