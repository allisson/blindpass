import { randomBytes } from 'node:crypto';
import { generateTotpCode, getTotpTimeRemaining } from '@blindpass/crypto';
import { type Page, type Cookie, expect } from '@playwright/test';

interface SavedSession {
  cookies: Cookie[];
  username: string;
}

async function waitForVaultHome(page: Page, timeout = 30_000): Promise<void> {
  await expect.poll(() => new URL(page.url()).pathname, { timeout }).toBe('/');
  await expect(page.getByTestId('vault-picker-trigger')).toBeVisible({ timeout });
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
  // vault-picker-trigger lives inside the list panel, which is hidden on settings/trash/health
  // pages and off-screen on item-detail pages. Navigate to vault home first if needed.
  if (new URL(page.url()).pathname !== '/') {
    await page.getByRole('link', { name: 'Vault', exact: true }).click();
    await page.waitForURL('/', { timeout: 10_000 });
  }
  await page.getByRole('button', { name: 'More options' }).click();
  await page.getByTestId('account-menu-lock').click();
}

// Installs a virtual platform authenticator with PRF enabled and pre-verified
// user presence so navigator.credentials.create / .get succeed without UI.
// Requires Chromium 121+ for the `hasPrf` flag.
export async function setupVirtualAuthenticator(
  page: Page,
): Promise<{ authenticatorId: string; cleanup: () => Promise<void> }> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('WebAuthn.enable', { enableUI: false });
  const { authenticatorId } = (await cdp.send('WebAuthn.addVirtualAuthenticator', {
    options: {
      protocol: 'ctap2',
      transport: 'internal',
      hasResidentKey: true,
      hasUserVerification: true,
      hasPrf: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  })) as { authenticatorId: string };
  const cleanup = async () => {
    try {
      await cdp.send('WebAuthn.removeVirtualAuthenticator', { authenticatorId });
      await cdp.send('WebAuthn.disable');
      await cdp.detach();
    } catch {
      /* best-effort */
    }
  };
  return { authenticatorId, cleanup };
}

export async function readBiometricEnrollmentCount(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      new Promise<number>((resolve, reject) => {
        const req = indexedDB.open('bp:biometric-unlock', 1);
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction('enrollment', 'readonly');
          const countReq = tx.objectStore('enrollment').count();
          countReq.onsuccess = () => resolve(countReq.result);
          countReq.onerror = () => reject(countReq.error);
        };
        req.onerror = () => reject(req.error);
      }),
  );
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

// Username regex on the server is /^[a-z0-9_]{3,32}$/. With Playwright's
// fullyParallel mode, beforeAll can re-run within the same worker for the same
// spec — so module-scope `const USERNAME = uniqueUsername(...)` collides on the
// second beforeAll. Always call this *inside* beforeAll, not at module scope.
// Suffix is 4 hex chars to keep prefix+timestamp+suffix under the 32-char limit.
export function uniqueUsername(prefix = 'test'): string {
  return `${prefix}_${Date.now()}_${randomBytes(2).toString('hex')}`;
}

export function uniqueEmail(prefix = 'test'): string {
  return `${prefix}.${Date.now()}.${randomBytes(2).toString('hex')}@example.com`;
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
  // The list panel slides off-screen (mobileHideList=true) on item detail/edit/new routes.
  // Use "Back to vault" (top of the detail view) rather than the Vault tab (bottom), since
  // a Sonner success toast at bottom-center can overlap the tab bar and intercept clicks.
  if (new URL(page.url()).pathname !== '/') {
    await page.getByRole('link', { name: 'Back to vault' }).click();
    await page.waitForURL('/', { timeout: 10_000 });
  }
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

export async function openItemAndReturn(page: Page, title: string): Promise<void> {
  await page.getByTestId('vault-list').getByText(title, { exact: true }).first().click();
  await page.waitForURL(/\/[^/]+$/, { timeout: 10_000 });
  await page.getByRole('link', { name: 'Back to vault' }).click();
  await page.waitForURL('/', { timeout: 10_000 });
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
  await page.getByTestId('vault-picker-trigger').waitFor({ state: 'visible', timeout: 15_000 });

  // Click the vault picker using data-testid
  await page.getByTestId('vault-picker-trigger').click();

  // Click "New vault" in the popover
  await page.getByTestId('new-vault-button').click();

  // Fill vault name and click "Create vault"
  await page.getByTestId('new-vault-name-input').fill(name);
  const createVaultResponse = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return response.request().method() === 'POST' && /\/vaults$/.test(url.pathname);
  });
  await page.getByTestId('confirm-create-vault-button').click();
  const response = await createVaultResponse;

  if (!response.ok()) {
    throw new Error(`Create vault failed: ${response.status()} ${await response.text()}`);
  }

  const trigger = page.getByTestId('vault-picker-trigger');
  const maybeSelected = await expect
    .poll(async () => await trigger.getAttribute('data-active-vault'), {
      timeout: 5_000,
      intervals: [250, 500, 1_000],
    })
    .not.toBeNull()
    .then(async () => (await trigger.getAttribute('data-active-vault')) === name)
    .catch(() => false);

  // Auto-switch can lag or be skipped in E2E. Fall back to selecting the new vault directly.
  if (!maybeSelected) {
    await trigger.click();
    await page.getByRole('dialog').getByRole('button', { name, exact: true }).click();
  }

  // Wait for the new vault to be selected
  await expect(trigger).toHaveAttribute('data-active-vault', name, { timeout: 15_000 });

  // Wait for URL to update with vaultId
  await page.waitForURL((url) => url.searchParams.has('vaultId'), { timeout: 10_000 });
  return new URL(page.url()).searchParams.get('vaultId') ?? '';
}
