import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { type Page, test, expect } from '@playwright/test';
import {
  captureBundle,
  createVaultItem,
  registerUser,
  uniqueUsername,
  unlockVault,
} from './helpers';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PASSWORD = 'importexport123!';
const PASSPHRASE = 'my-export-passphrase-xyz';

let savedBundle: string;

// page.goto reloads the page, clearing the in-memory keychain and locking the vault.
// Always navigate to settings via SPA link clicks to preserve the keychain.
async function goToExport(page: Page): Promise<void> {
  await page
    .getByRole('link', { name: /settings/i })
    .first()
    .click();
  await page.waitForURL('/settings', { timeout: 10_000 });
  await page.getByRole('link', { name: 'Export', exact: true }).first().click();
  await page.waitForURL('/settings/export', { timeout: 10_000 });
}

async function goToImport(page: Page): Promise<void> {
  await page
    .getByRole('link', { name: /settings/i })
    .first()
    .click();
  await page.waitForURL('/settings', { timeout: 10_000 });
  await page.getByRole('link', { name: 'Import', exact: true }).first().click();
  await page.waitForURL('/settings/import', { timeout: 10_000 });
}

test.beforeAll(async ({ browser }) => {
  test.setTimeout(120_000);
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  try {
    await registerUser(page, uniqueUsername('impexp'), PASSWORD);
    await createVaultItem(page, 'login', 'Export Login', {
      Username: 'user@export.test',
      Password: 'pass123',
    });
    savedBundle = await captureBundle(page);
  } finally {
    await ctx.close();
  }
  expect(savedBundle, 'registration must succeed').toBeTruthy();
});

test.beforeEach(async ({ page }) => {
  test.setTimeout(60_000);
  await unlockVault(page, savedBundle, PASSWORD);
});

// ── Export tests ────────────────────────────────────────────────────────────

test('export plaintext JSON shows warning then downloads file', async ({ page }) => {
  await goToExport(page);
  await page.getByRole('button', { name: 'Export as JSON' }).click();
  await expect(page.getByRole('alert')).toBeVisible();

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Export plaintext' }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/blindpass-export.*\.json$/);
  await expect(page.getByText(/\d+ items? exported from/)).toBeVisible({ timeout: 10_000 });

  await page.getByRole('button', { name: 'Export again' }).click();
  await expect(page.getByRole('button', { name: 'Export as JSON' })).toBeVisible();
});

test('export: cancel from warning returns to idle', async ({ page }) => {
  await goToExport(page);
  await page.getByRole('button', { name: 'Export as JSON' }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByRole('button', { name: 'Export as JSON' })).toBeVisible();
});

test('export encrypted rejects mismatched passphrases', async ({ page }) => {
  await goToExport(page);
  await page.getByRole('button', { name: /Export encrypted/ }).click();
  await expect(page.getByLabel('Export passphrase')).toBeVisible();
  await page.getByLabel('Export passphrase').fill(PASSPHRASE);
  await page.getByLabel('Confirm passphrase').fill('different-passphrase');
  await page.getByRole('button', { name: 'Download encrypted' }).click();
  await expect(page.getByText('Passphrases do not match')).toBeVisible();
});

test('export encrypted downloads .blindpass and shows success', async ({ page }) => {
  await goToExport(page);
  await page.getByRole('button', { name: /Export encrypted/ }).click();
  await expect(page.getByLabel('Export passphrase')).toBeVisible();
  await page.getByLabel('Export passphrase').fill(PASSPHRASE);
  await page.getByLabel('Confirm passphrase').fill(PASSPHRASE);

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download encrypted' }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/blindpass-export.*\.blindpass$/);
  await expect(page.getByText(/\d+ items? exported from/)).toBeVisible({ timeout: 30_000 });
});

test('export: cancel from passphrase form returns to idle', async ({ page }) => {
  await goToExport(page);
  await page.getByRole('button', { name: /Export encrypted/ }).click();
  await expect(page.getByLabel('Export passphrase')).toBeVisible();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByRole('button', { name: 'Export as JSON' })).toBeVisible();
});

// ── Import tests ─────────────────────────────────────────────────────────────

test('import plaintext blindpass JSON auto-detects format and imports', async ({ page }) => {
  const fixture = await readFile(path.join(__dirname, 'fixtures/blindpass-export.json'));
  await goToImport(page);
  await page.locator('input[type="file"]').setInputFiles({
    name: 'blindpass-export.json',
    mimeType: 'application/json',
    buffer: fixture,
  });
  await expect(page.getByText('auto-detected')).toBeVisible({ timeout: 5_000 });
  await page.getByRole('button', { name: 'Preview import' }).click();
  await expect(page.getByText('Found')).toBeVisible({ timeout: 10_000 });
  await page.getByRole('button', { name: /^Import \d+ items?$/ }).click();
  await expect(page.getByText(/items? imported/)).toBeVisible({ timeout: 30_000 });
});

// Serial group: first test exports the .blindpass fixture; subsequent tests consume it.
test.describe.serial('encrypted import', () => {
  let bpContent: Buffer;

  test('export encrypted .blindpass as import fixture', async ({ page }) => {
    await goToExport(page);
    await page.getByRole('button', { name: /Export encrypted/ }).click();
    await expect(page.getByLabel('Export passphrase')).toBeVisible();
    await page.getByLabel('Export passphrase').fill(PASSPHRASE);
    await page.getByLabel('Confirm passphrase').fill(PASSPHRASE);
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Download encrypted' }).click(),
    ]);
    await expect(page.getByText(/exported from/)).toBeVisible({ timeout: 30_000 });
    const bpPath = await download.path();
    bpContent = bpPath ? await readFile(bpPath) : Buffer.alloc(0);
    expect(bpContent.byteLength, 'encrypted export must produce content').toBeGreaterThan(0);
  });

  test('import encrypted .blindpass prompts for passphrase and imports', async ({ page }) => {
    test.skip(!bpContent?.byteLength, 'depends on export fixture test');
    await goToImport(page);
    await page.locator('input[type="file"]').setInputFiles({
      name: 'blindpass-export.blindpass',
      mimeType: 'application/json',
      buffer: bpContent,
    });
    await expect(page.getByText('auto-detected')).toBeVisible({ timeout: 5_000 });
    await page.getByRole('button', { name: 'Preview import' }).click();
    await expect(page.getByLabel('Decryption passphrase')).toBeVisible({ timeout: 5_000 });
    await page.getByLabel('Decryption passphrase').fill(PASSPHRASE);
    await page.getByRole('button', { name: 'Decrypt' }).click();
    await expect(page.getByText('Found')).toBeVisible({ timeout: 30_000 });
    await page.getByRole('button', { name: /^Import \d+ items?$/ }).click();
    await expect(page.getByText(/items? imported/)).toBeVisible({ timeout: 30_000 });
  });

  test('import encrypted .blindpass with wrong passphrase shows error then recovers', async ({
    page,
  }) => {
    test.skip(!bpContent?.byteLength, 'depends on export fixture test');
    await goToImport(page);
    await page.locator('input[type="file"]').setInputFiles({
      name: 'blindpass-export.blindpass',
      mimeType: 'application/json',
      buffer: bpContent,
    });
    await page.getByRole('button', { name: 'Preview import' }).click();
    await expect(page.getByLabel('Decryption passphrase')).toBeVisible({ timeout: 5_000 });
    await page.getByLabel('Decryption passphrase').fill('wrong-passphrase');
    await page.getByRole('button', { name: 'Decrypt' }).click();
    await expect(page.getByText('Incorrect passphrase')).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: 'Try again' }).click();
    await expect(page.getByRole('button', { name: 'Preview import' })).toBeVisible();
  });
});
