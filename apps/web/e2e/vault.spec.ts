import { test, expect } from '@playwright/test';
import { captureBundle, registerUser, uniqueUsername, unlockVault } from './helpers';

const USERNAME = uniqueUsername('vault');
const PASSWORD = 'vaulttest123!';
let savedBundle: string;

test.beforeAll(async ({ browser }) => {
  test.setTimeout(90_000);
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  try {
    await registerUser(page, USERNAME, PASSWORD);
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

test('vault index shows welcome state when authenticated', async ({ page }) => {
  await expect(page.getByText('Your vault is unlocked')).toBeVisible();
  await expect(page.getByText('Welcome back')).toBeVisible();
});

test('new item link is visible', async ({ page }) => {
  await expect(page.getByRole('main').getByRole('link', { name: 'New item' })).toBeVisible();
});
