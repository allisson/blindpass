import { generateTotpCode, getTotpTimeRemaining } from '@blindpass/crypto';
import { type Page, type Cookie, expect } from '@playwright/test';

interface SavedSession {
  cookies: Cookie[];
  username: string;
}

async function waitForVaultHome(page: Page, timeout = 30_000): Promise<void> {
  await expect.poll(() => new URL(page.url()).pathname, { timeout }).toBe('/');
  await expect(page.getByTestId('vault-list-heading')).toBeVisible({ timeout });
}

export async function captureBundle(page: Page): Promise<string> {
  const cookies = await page.context().cookies();
  const hasSession = cookies.some((c) => c.name === 'bp_session');
  if (!hasSession) throw new Error('No bp_session cookie after registration');

  const username = await page.evaluate(() => localStorage.getItem('bp:last-username'));
  if (!username) throw new Error('bp:last-username not set after registration');

  return JSON.stringify({ cookies, username } satisfies SavedSession);
}

export async function unlockVault(
  page: Page,
  savedBundle: string,
  password: string,
): Promise<void> {
  const saved = JSON.parse(savedBundle) as SavedSession;
  await page.context().addCookies(saved.cookies);

  // Establish origin so we can write to localStorage before the vault guard runs.
  await page.goto('/login');
  await page.evaluate((u) => localStorage.setItem('bp:last-username', u), saved.username);

  await page.goto('/');
  await page.waitForURL(/\/unlock/, { timeout: 10_000 });
  await page.getByLabel('Master password').fill(password);
  await page.getByRole('button', { name: 'Unlock vault' }).click();
  await waitForVaultHome(page);
}

export async function lockVault(page: Page): Promise<void> {
  await page.getByTestId('account-menu-trigger').click();
  await page.getByTestId('account-menu-lock').click();
}

export async function fillAuthenticatorCode(page: Page, code: string): Promise<void> {
  for (let i = 0; i < 6; i++) {
    await page.getByLabel(`Digit ${i + 1} of 6`).fill(code[i] ?? '');
  }
}

export async function readSetupKey(page: Page): Promise<string> {
  const setupKey = (await page.getByTestId('setup-key').textContent())?.trim();
  if (!setupKey) throw new Error('Setup key not visible on page');
  return setupKey;
}

export function makeAuthenticatorCode(setupKey: string, offsetMs = 0): string {
  return generateTotpCode(setupKey, undefined, Date.now() + offsetMs);
}

async function _doRegister(page: Page, username: string, password: string): Promise<string> {
  await page.goto('/register');
  await page.getByLabel('Username').fill(username);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByLabel('Confirm password').fill(password);
  await page.getByRole('button', { name: 'Create account' }).click();

  await page.waitForURL(/authenticator.*mode=register/, { timeout: 30_000 });
  await expect(page.getByText(username)).toBeVisible();
  const setupKey = await readSetupKey(page);
  await fillAuthenticatorCode(page, makeAuthenticatorCode(setupKey));
  await page.getByRole('button', { name: 'Verify' }).click();

  try {
    await page.waitForURL(/\/recovery-key/, { timeout: 5_000 });
  } catch {
    await fillAuthenticatorCode(page, makeAuthenticatorCode(setupKey, 30_000));
    await page.getByRole('button', { name: 'Verify' }).click();
    await page.waitForURL(/\/recovery-key/, { timeout: 30_000 });
  }
  return setupKey;
}

export async function registerUser(
  page: Page,
  username: string,
  password: string,
): Promise<string> {
  const setupKey = await _doRegister(page, username, password);
  await page.getByLabel('I have saved my recovery key in a safe place').click();
  await page.getByRole('button', { name: "I've saved my recovery key" }).click();
  await page.waitForURL('/', { timeout: 15_000 });
  return setupKey;
}

export async function registerAndCaptureKey(
  page: Page,
  username: string,
  password: string,
): Promise<string> {
  await _doRegister(page, username, password);

  const wordEls = page.getByTestId('recovery-word');
  await wordEls.first().waitFor({ timeout: 10_000 });
  const recoveryKey = (await wordEls.allTextContents()).map((w) => w.trim()).join(' ');

  await page.getByLabel('I have saved my recovery key in a safe place').click();
  await page.getByRole('button', { name: "I've saved my recovery key" }).click();
  await page.waitForURL('/', { timeout: 15_000 });

  return recoveryKey;
}

export async function loginAs(
  page: Page,
  username: string,
  password: string,
  setupKey: string,
): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Username').fill(username);
  await page.getByLabel('Master password').fill(password);
  await page.getByRole('button', { name: 'Continue' }).click();

  await page.waitForURL(/authenticator.*mode=login/, { timeout: 15_000 });
  await fillAuthenticatorCode(page, makeAuthenticatorCode(setupKey, 30_000));
  await page.getByRole('button', { name: 'Verify' }).click();

  // If the TOTP counter was already consumed (same user logged in recently within the
  // same 30-second window), wait for the next window boundary and retry.
  const rejected = await page
    .getByTestId('error-message')
    .waitFor({ timeout: 3_000 })
    .then(() => true)
    .catch(() => false);
  if (rejected) {
    await page.waitForTimeout(getTotpTimeRemaining(30) * 1000 + 1000);
    await fillAuthenticatorCode(page, makeAuthenticatorCode(setupKey, 30_000));
    await page.getByRole('button', { name: 'Verify' }).click();
  }
}

export function uniqueUsername(prefix = 'test'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

export function uniqueEmail(prefix = 'test'): string {
  return `${prefix}.${Date.now()}.${Math.random().toString(36).slice(2, 6)}@example.com`;
}

const TYPE_PICKER_LABEL: Record<
  | 'login'
  | 'secure_note'
  | 'payment_card'
  | 'identity'
  | 'totp'
  | 'developer_credential'
  | 'crypto_wallet',
  string
> = {
  login: 'Login',
  secure_note: 'Secure Note',
  payment_card: 'Payment Card',
  identity: 'Identity',
  totp: 'Authenticator',
  developer_credential: 'Developer',
  crypto_wallet: 'Crypto Wallet',
};

export async function createVaultItem(
  page: Page,
  type:
    | 'login'
    | 'secure_note'
    | 'payment_card'
    | 'identity'
    | 'totp'
    | 'developer_credential'
    | 'crypto_wallet',
  title: string,
  fields: Record<string, string> = {},
): Promise<void> {
  // Click the SPA link to preserve in-memory session (page.goto would reload and lose it)
  // Scope to vault-list panel and use aria-label to avoid matching onboarding "New item" link.
  await page.getByTestId('vault-list').getByLabel('New item').click();
  await page.waitForURL(/\/items\/new/, { timeout: 10_000 });

  // Select type from picker (scope to main to avoid sidebar type-filter buttons)
  await page.getByRole('main').getByRole('button', { name: TYPE_PICKER_LABEL[type] }).click();
  await page.waitForURL((url) => url.searchParams.get('type') === type, { timeout: 10_000 });

  await page.getByLabel('Title').and(page.locator('input, textarea')).fill(title);

  for (const [labelText, value] of Object.entries(fields)) {
    await page.getByLabel(labelText).and(page.locator('input, textarea')).fill(value);
  }

  await page.getByRole('button', { name: 'Create item' }).click();
  await page.waitForURL((url) => !url.pathname.includes('/new'), { timeout: 15_000 });
}

export async function createVault(page: Page, name: string): Promise<string> {
  // Ensure we are on a page where the vault layout is present
  if (!page.url().endsWith('/') && !page.url().includes('/unlock')) {
    await page.goto('/');
  }

  // Handle unlock if needed
  if (page.url().includes('/unlock')) {
    await page.getByLabel('Master password').fill('sharingtest123!');
    await page.getByRole('button', { name: 'Unlock vault' }).click();
    await page.waitForURL((url) => !url.pathname.includes('/unlock'), { timeout: 15_000 });
  }

  // Wait for the vault list to be visible to ensure the layout is ready
  await page.getByTestId('vault-list-heading').waitFor({ state: 'visible', timeout: 15_000 });

  // Click the vault picker using data-testid
  await page.getByTestId('vault-picker-trigger').click();

  // Click "New vault" in the popover
  await page.getByTestId('new-vault-button').click();

  // Fill vault name and click "Create vault"
  await page.getByTestId('new-vault-name-input').fill(name);
  await page.getByTestId('confirm-create-vault-button').click();

  // Wait for the new vault to be selected (auto-switched by hook)
  const trigger = page.getByTestId('vault-picker-trigger');
  await expect(trigger).toContainText(name, { timeout: 15_000 });

  // Wait for URL to update with vaultId
  await page.waitForURL((url) => url.searchParams.has('vaultId'), { timeout: 10_000 });
  return new URL(page.url()).searchParams.get('vaultId') ?? '';
}
