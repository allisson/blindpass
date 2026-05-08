import { fileURLToPath } from 'url';
import path from 'path';
import { test, expect } from '@playwright/test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
import {
  captureBundle,
  createVaultItem,
  registerUser,
  uniqueUsername,
  unlockVault,
} from './helpers';

const PASSWORD = 'itemstest123!';
let savedBundle: string;

test.beforeAll(async ({ browser }) => {
  test.setTimeout(90_000);
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  try {
    await registerUser(page, uniqueUsername('items'), PASSWORD);
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

test('creates a login item and shows it in the vault list', async ({ page }) => {
  await createVaultItem(page, 'login', 'My GitHub', {
    Username: 'user@example.com',
    Password: 'hunter2',
  });
  await expect(page.getByTestId('vault-list').getByText('My GitHub')).toBeVisible({
    timeout: 10_000,
  });
});

test('creates a secure note and shows it in the vault list', async ({ page }) => {
  await createVaultItem(page, 'secure_note', 'Secret Note', {
    Content: 'This is a private note.',
  });
  await expect(page.getByTestId('vault-list').getByText('Secret Note')).toBeVisible({
    timeout: 10_000,
  });
});

test('creates a payment card and shows it in the vault list', async ({ page }) => {
  await createVaultItem(page, 'payment_card', 'Visa Platinum', {
    'Cardholder Name': 'Jane Doe',
    'Card Number': '0000000000000000',
    Month: '12',
    Year: '2030',
  });
  await expect(page.getByTestId('vault-list').getByText('Visa Platinum')).toBeVisible({
    timeout: 10_000,
  });
});

test('creates an identity and shows it in the vault list', async ({ page }) => {
  await createVaultItem(page, 'identity', 'My Identity', {
    'First Name': 'Jane',
    'Last Name': 'Doe',
  });
  await expect(page.getByTestId('vault-list').getByText('My Identity')).toBeVisible({
    timeout: 10_000,
  });
});

test('creates a totp item and shows it in the vault list', async ({ page }) => {
  await createVaultItem(page, 'totp', 'GitHub 2FA', {
    'Paste URI or Secret':
      'otpauth://totp/GitHub:user@example.com?secret=JBSWY3DPEHPK3PXP&issuer=GitHub',
  });
  await expect(page.getByTestId('vault-list').getByText('GitHub 2FA')).toBeVisible({
    timeout: 10_000,
  });
});

test('creates a developer credential item and masks secrets in detail view', async ({ page }) => {
  await createVaultItem(page, 'developer_credential', 'OpenAI prod key', {
    Provider: 'OpenAI',
    Environment: 'production',
    'Base URL': 'https://api.openai.com/v1',
    Secret: 'sk-secret',
    'Key ID': 'primary',
  });

  const vaultList = page.getByTestId('vault-list');
  await expect(vaultList.getByText('OpenAI prod key')).toBeVisible({ timeout: 10_000 });
  await expect(vaultList.getByText('OpenAI · production')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText('Provider')).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('main').getByText('OpenAI', { exact: true }).last()).toBeVisible();
  await expect(page.getByText('Endpoint')).toBeVisible();
  await expect(page.locator('main')).not.toContainText('sk-secret');
  await page.getByRole('button', { name: 'Show password' }).click();
  await expect(page.getByText('sk-secret')).toBeVisible();
});

test('imports Chrome CSV via batch endpoint and shows items in vault list', async ({ page }) => {
  test.setTimeout(60_000);

  await page
    .getByRole('link', { name: /settings/i })
    .first()
    .click();
  await page.waitForURL('/settings', { timeout: 10_000 });

  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles(path.join(__dirname, 'fixtures/chrome-import.csv'));

  await expect(page.getByText('auto-detected')).toBeVisible({ timeout: 5_000 });

  await page.getByRole('button', { name: 'Preview import' }).click();
  await expect(page.getByText('Found')).toBeVisible({ timeout: 5_000 });

  await page.getByRole('button', { name: /^Import \d+ items?$/ }).click();

  await expect(page.getByText(/items? imported/)).toBeVisible({ timeout: 30_000 });

  await page
    .getByRole('link', { name: /vault|home/i })
    .first()
    .click();
  await page.waitForURL('/', { timeout: 10_000 });
  await expect(page.getByTestId('vault-list').getByText('GitHub', { exact: true })).toBeVisible({
    timeout: 10_000,
  });
});
