import { test, expect } from '@playwright/test';
import { captureBundle, registerUser, uniqueUsername, unlockVault } from './helpers';

const PASSWORD = 'wallettest123!';
// Known-valid 12-word BIP39 mnemonic
const VALID_MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

let savedBundle: string;

test.beforeAll(async ({ browser }) => {
  test.setTimeout(90_000);
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  try {
    await registerUser(page, uniqueUsername('wallet'), PASSWORD);
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

test('creates a crypto wallet item and shows it in the vault list', async ({ page }) => {
  await page.getByTestId('vault-list').getByLabel('New item').click();
  await page.waitForURL(/\/items\/new/, { timeout: 10_000 });

  await page.getByRole('main').getByRole('button', { name: 'Crypto Wallet' }).click();
  await page.waitForURL((url) => url.searchParams.get('type') === 'crypto_wallet', {
    timeout: 10_000,
  });

  await page.getByLabel('Title').and(page.locator('input, textarea')).fill('My ETH Wallet');

  // Paste mnemonic into the textarea
  await page.getByPlaceholder('Paste mnemonic here…').fill(VALID_MNEMONIC);
  // Trigger onChange by blurring
  await page.getByLabel('Title').click();

  // Word grid should appear with 12 cells
  await expect(page.getByText('12 words')).toBeVisible({ timeout: 5_000 });

  // Fill metadata
  await page.getByLabel('Network').fill('ethereum');
  await page.getByLabel('Derivation Path').fill("m/44'/60'/0'/0/0");

  await page.getByRole('button', { name: 'Create item' }).click();
  await page.waitForURL((url) => !url.pathname.includes('/new'), { timeout: 15_000 });

  await expect(page.getByTestId('vault-list').getByText('My ETH Wallet')).toBeVisible({
    timeout: 10_000,
  });
});

test('shows checksum warning for invalid mnemonic word', async ({ page }) => {
  await page.getByTestId('vault-list').getByLabel('New item').click();
  await page.waitForURL(/\/items\/new/, { timeout: 10_000 });

  await page.getByRole('main').getByRole('button', { name: 'Crypto Wallet' }).click();
  await page.waitForURL((url) => url.searchParams.get('type') === 'crypto_wallet', {
    timeout: 10_000,
  });

  // Paste mnemonic with last word replaced by non-wordlist word
  const badMnemonic = VALID_MNEMONIC.replace('about', 'zzzzz');
  await page.getByPlaceholder('Paste mnemonic here…').fill(badMnemonic);
  await page.getByLabel('Title').click();

  await expect(page.getByText(/not in the BIP39 English wordlist/)).toBeVisible({ timeout: 5_000 });

  // Save is still allowed (soft warn)
  await page.getByLabel('Title').and(page.locator('input, textarea')).fill('Bad Wallet');
  await expect(page.getByRole('button', { name: 'Create item' })).not.toBeDisabled();
});

test('blocks save for wrong word count', async ({ page }) => {
  await page.getByTestId('vault-list').getByLabel('New item').click();
  await page.waitForURL(/\/items\/new/, { timeout: 10_000 });

  await page.getByRole('main').getByRole('button', { name: 'Crypto Wallet' }).click();
  await page.waitForURL((url) => url.searchParams.get('type') === 'crypto_wallet', {
    timeout: 10_000,
  });

  // Paste 13-word mnemonic (invalid count)
  const thirteenWords = VALID_MNEMONIC + ' abandon';
  await page.getByPlaceholder('Paste mnemonic here…').fill(thirteenWords);
  await page.getByLabel('Title').and(page.locator('input, textarea')).fill('Bad Count Wallet');
  await page.getByLabel('Title').click();

  await page.getByRole('button', { name: 'Create item' }).click();
  await expect(page.getByText(/12, 15, 18, 21, or 24 words/)).toBeVisible({ timeout: 5_000 });
});
