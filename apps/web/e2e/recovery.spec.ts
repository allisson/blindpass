import { test, expect } from '@playwright/test';
import {
  lockVault,
  makeAuthenticatorCode,
  readSetupKey,
  registerAndCaptureKey,
  uniqueUsername,
} from './helpers';

const USERNAME = uniqueUsername('recovery');
const OLD_PASSWORD = 'oldpassword123!';
const NEW_PASSWORD = 'newpassword456!';

let recoveryKey: string;

test.beforeAll(async ({ browser }) => {
  test.setTimeout(90_000);
  const page = await browser.newPage();
  try {
    recoveryKey = await registerAndCaptureKey(page, USERNAME, OLD_PASSWORD);
  } finally {
    await page.close();
  }
  expect(recoveryKey, 'User registration must succeed').toBeTruthy();
});

test('"Recover with key" link on login navigates to /recover', async ({ page }) => {
  await page.goto('/login');
  await page.getByRole('link', { name: 'Recover account' }).click();
  await expect(page).toHaveURL('/recover');
  await expect(page.getByText('Recover account')).toBeVisible();
});

test('full recovery flow resets password; old password cannot unlock after', async ({ page }) => {
  test.setTimeout(90_000);

  await page.goto('/recover');
  await page.getByLabel('Username').fill(USERNAME);
  await page.getByLabel('Recovery phrase').fill(recoveryKey);
  await page.getByRole('button', { name: 'Continue recovery' }).click();

  await page.waitForURL('/reset-password', { timeout: 30_000 });
  const setupKey = await readSetupKey(page);
  await page.getByLabel('Authenticator code').fill(makeAuthenticatorCode(setupKey, 30_000));
  await page.getByLabel('New master password').fill(NEW_PASSWORD);
  await page.getByLabel('Confirm new password').fill(NEW_PASSWORD);
  await page.getByRole('button', { name: 'Complete recovery' }).click();

  await page.waitForURL('/recovery-key', { timeout: 30_000 });
  await page.getByLabel('I have saved my recovery key in a safe place').click();
  await page.getByRole('button', { name: "I've saved my recovery key" }).click();
  await page.waitForURL('/', { timeout: 15_000 });
  await expect(page.getByText('Your vault is unlocked')).toBeVisible();

  // Lock and verify old password no longer works
  await lockVault(page);
  await page.waitForURL('/unlock');
  await page.getByLabel('Master password').fill(OLD_PASSWORD);
  await page.getByRole('button', { name: 'Unlock vault' }).click();
  await expect(page.getByTestId('error-message')).toBeVisible({ timeout: 15_000 });
  await expect(page).toHaveURL('/unlock');
});
