import path from 'node:path';
import { test, expect, type Page } from '@playwright/test';
import {
  createVaultItem,
  fillAuthenticatorCode,
  makeAuthenticatorCode,
  readSetupKey,
  uniqueUsername,
} from './helpers';

const DISPLAY_NAME = 'mona_aurora';

// Strip ephemeral demo cruft (toasts, dynamic test username) just before capture
// so the screenshot reflects a steady-state vault, not the test fixture machinery.
async function polishForScreenshot(page: Page, originalUsername: string): Promise<void> {
  await page.evaluate(
    ({ orig, name }) => {
      document.querySelectorAll('[data-sonner-toast]').forEach((el) => el.remove());
      // Replace any visible text containing the throwaway username.
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      const updates: Text[] = [];
      let node = walker.nextNode();
      while (node) {
        if (node.textContent?.includes(orig)) updates.push(node as Text);
        node = walker.nextNode();
      }
      for (const t of updates) t.textContent = t.textContent?.replaceAll(orig, name) ?? null;
    },
    { orig: originalUsername, name: DISPLAY_NAME },
  );
}

const VIEWPORT = { width: 1280, height: 800 };
const PASSWORD = 'BlindPassDemo!2025';

// Canonical all-zeros valid 24-word BIP39 phrase (256-bit entropy, matching
// BlindPass's recovery key length). Recognizable as a placeholder so readers
// don't mistake the screenshot for a leaked recovery key.
const ABANDON_PHRASE = `${'abandon '.repeat(23)}art`;

const SCREENSHOTS_DIR = path.resolve(import.meta.dirname, '../../../docs/screenshots');

const THEMES = ['light', 'dark'] as const;

test.describe('@screenshot screenshots', () => {
  for (const theme of THEMES) {
    test(`capture ${theme}`, async ({ browser }) => {
      test.setTimeout(120_000);
      const context = await browser.newContext({
        viewport: VIEWPORT,
        // Skip framer-motion entry animations so screenshots land on steady-state UI.
        reducedMotion: 'reduce',
      });
      // Set theme before any page script runs; theme-bootstrap.js reads this on load.
      await context.addInitScript((t) => {
        localStorage.setItem('bp:theme', t);
      }, theme);

      const page = await context.newPage();
      const file = (n: string) => path.join(SCREENSHOTS_DIR, theme, `${n}.png`);

      // 01 — Sign in (public)
      await page.goto('/login');
      await expect(page.getByRole('button', { name: 'Continue' })).toBeVisible();
      await page.screenshot({ path: file('01-login') });

      // 02 — Recovery key reveal during registration
      const username = uniqueUsername('sshot');
      await page.goto('/register');
      await page.getByLabel('Username').fill(username);
      await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
      await page.getByLabel('Confirm password').fill(PASSWORD);
      await page.getByRole('button', { name: 'Create account' }).click();

      await page.waitForURL(/authenticator.*mode=register/, { timeout: 30_000 });
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

      const wordEls = page.locator('[data-testid="recovery-word"]');
      await wordEls.first().waitFor({ timeout: 10_000 });
      await page.evaluate((phrase) => {
        const words = phrase.split(' ');
        document.querySelectorAll('[data-testid="recovery-word"]').forEach((el, i) => {
          if (words[i]) el.textContent = words[i];
        });
      }, ABANDON_PHRASE);

      await page.screenshot({ path: file('02-register') });

      await page.getByLabel('I have saved my recovery key in a safe place').click();
      await page.getByRole('button', { name: "I've saved my recovery key" }).click();
      await page.waitForURL('/', { timeout: 15_000 });
      await expect(page.getByTestId('vault-picker-trigger')).toBeVisible();

      // Seed a fictional, item-type-diverse vault.
      await createVaultItem(page, 'login', 'Mailbox', {
        Username: 'mona@example.org',
        Password: 'correct horse battery staple',
      });
      await createVaultItem(page, 'payment_card', 'Travel card', {
        'Cardholder Name': 'Mona Aurora',
        'Card Number': '4242 4242 4242 4242',
        Month: '08',
        Year: '2029',
      });
      await createVaultItem(page, 'secure_note', 'Cabin Wi-Fi', {
        Content: 'Network: cabin-5g\nKey: north-river-pine',
      });
      await createVaultItem(page, 'identity', 'Public ID', {
        'First Name': 'Mona',
        'Last Name': 'Aurora',
      });
      await createVaultItem(page, 'developer_credential', 'Staging deploy key', {
        Provider: 'Custom',
        Environment: 'staging',
        Secret: 'dpl_demo_xxxxxxxxxxxxxxxx',
      });
      await createVaultItem(page, 'totp', 'Build server', {
        'Paste URI or Secret':
          'otpauth://totp/Build%20server:mona@example.org?secret=JBSWY3DPEHPK3PXP&issuer=Build%20server',
      });

      // After the last createVaultItem we're on /$itemId. Use SPA navigation
      // for the rest of the captures — page.goto would full-reload and lock the vault.

      // 03 — Vault home (populated). Click bottom tab Vault link (SPA, no reload).
      await page.getByRole('link', { name: 'Vault', exact: true }).click();
      await page.waitForURL('/', { timeout: 10_000 });
      await expect(page.getByTestId('vault-picker-trigger')).toBeVisible();
      await expect(page.getByTestId('vault-list').getByText('Mailbox')).toBeVisible();
      await polishForScreenshot(page, username);
      await page.screenshot({ path: file('03-vault') });

      // 04 — Item detail
      await page.getByTestId('vault-list').getByText('Mailbox').click();
      await page.waitForURL(/\/[0-9a-f-]{36}/, { timeout: 10_000 });
      await polishForScreenshot(page, username);
      await page.screenshot({ path: file('04-item') });

      // 05 — New item type picker. After step 04 we're on /$itemId where the list panel
      // is off-screen (mobile layout). Navigate back to vault root first.
      await page.getByRole('link', { name: 'Back to vault' }).click();
      await page.waitForURL('/', { timeout: 10_000 });
      await page.getByTestId('vault-list').getByLabel('New item').click();
      await page.waitForURL(/\/items\/new$/, { timeout: 10_000 });
      await expect(page.getByRole('heading', { name: 'New item' })).toBeVisible();
      await polishForScreenshot(page, username);
      await page.screenshot({ path: file('05-new-item') });

      // 06 — Settings — bottom tab link, SPA navigation. The vault-list panel is
      // unmounted on /settings (showListPanel === false in VaultLayout). Wait for
      // it to leave the DOM so the screenshot doesn't catch a transition frame.
      await page.getByRole('link', { name: 'Settings', exact: true }).click();
      await page.waitForURL(/\/settings$/, { timeout: 10_000 });
      await expect(page.getByTestId('vault-list')).toBeHidden();
      await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
      await page.waitForLoadState('networkidle');
      await polishForScreenshot(page, username);
      await page.screenshot({ path: file('06-settings') });

      await context.close();
    });
  }
});
