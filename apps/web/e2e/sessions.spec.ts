import { test, expect, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { captureBundle, loginAs, registerUser, uniqueUsername, unlockVault } from './helpers';

const PASSWORD = 'sessionstest123!';
const USERNAME = uniqueUsername('sessions');
let savedBundle: string;
let setupKey: string;

async function openOwnerSessionsPage(
  browser: Browser,
): Promise<{ ownerCtx: BrowserContext; ownerPage: Page }> {
  const ownerCtx = await browser.newContext();
  const ownerPage = await ownerCtx.newPage();
  await unlockVault(ownerPage, savedBundle, PASSWORD);
  await ownerPage.getByRole('link', { name: 'Sessions' }).click();
  await ownerPage.waitForURL('/sessions');
  return { ownerCtx, ownerPage };
}

async function openSecondDevice(
  browser: Browser,
): Promise<{ deviceCtx: BrowserContext; page: Page }> {
  const deviceCtx = await browser.newContext();
  const page = await deviceCtx.newPage();
  await loginAs(page, USERNAME, PASSWORD, setupKey);
  return { deviceCtx, page };
}

async function refetchSessions(ownerPage: Page): Promise<void> {
  await ownerPage.getByRole('link', { name: 'Vault' }).click();
  await ownerPage.waitForURL('/');
  await ownerPage.getByRole('link', { name: 'Sessions' }).click();
  await ownerPage.waitForURL('/sessions');
  await expect(ownerPage.getByRole('heading', { name: 'Active Sessions' })).toBeVisible();
}

async function getSessionCount(page: Page): Promise<number> {
  return page.evaluate(async () => {
    const res = await fetch('/auth/sessions', { credentials: 'include' });
    if (!res.ok) throw new Error(`Failed to fetch sessions: ${res.status}`);
    const data = (await res.json()) as { sessions: Array<{ id: string }> };
    return data.sessions.length;
  });
}

async function revokeFirstOtherSession(page: Page): Promise<number> {
  return page.evaluate(async () => {
    const listRes = await fetch('/auth/sessions', { credentials: 'include' });
    if (!listRes.ok) throw new Error(`Failed to fetch sessions: ${listRes.status}`);
    const data = (await listRes.json()) as { sessions: Array<{ id: string; isCurrent: boolean }> };
    const target = data.sessions.find((session) => !session.isCurrent);
    if (!target) throw new Error('No non-current session found');
    const deleteRes = await fetch(`/auth/sessions/${target.id}`, {
      method: 'DELETE',
      credentials: 'include',
      headers: { 'x-bp-client': 'web' },
    });
    return deleteRes.status;
  });
}

async function revokeAllOtherSessions(page: Page): Promise<number> {
  return page.evaluate(async () => {
    const res = await fetch('/auth/sessions', {
      method: 'DELETE',
      credentials: 'include',
      headers: { 'x-bp-client': 'web' },
    });
    return res.status;
  });
}

test.beforeAll(async ({ browser }) => {
  test.setTimeout(90_000);
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  try {
    setupKey = await registerUser(page, USERNAME, PASSWORD);
    savedBundle = await captureBundle(page);
  } finally {
    await ctx.close();
  }
  expect(savedBundle, 'User registration must succeed').toBeTruthy();
  expect(setupKey, 'Authenticator setup must succeed').toBeTruthy();
});

test.describe.serial('sessions page basics', () => {
  let ownerPage: Page;
  let ownerCtx: BrowserContext;

  test.beforeAll(async ({ browser }) => {
    test.setTimeout(90_000);
    ({ ownerCtx, ownerPage } = await openOwnerSessionsPage(browser));
  });

  test.afterAll(async () => {
    await ownerCtx.close();
  });

  test('sessions page shows active sessions heading', async () => {
    await expect(ownerPage.getByRole('heading', { name: 'Active Sessions' })).toBeVisible();
  });

  test('current session shows "This device" badge', async () => {
    await expect(ownerPage.getByText('This device')).toBeVisible({ timeout: 10_000 });
  });

  test('current session has no revoke button', async () => {
    await ownerPage.getByText('This device', { exact: true }).waitFor({ timeout: 10_000 });

    const currentSessionRow = ownerPage
      .locator('[data-testid="session-row"]')
      .filter({ has: ownerPage.getByText('This device', { exact: true }) });
    await expect(currentSessionRow.getByRole('button', { name: 'Revoke' })).not.toBeVisible();
  });
});

test.describe.serial('revocation', () => {
  test.describe.serial('single session revoke flow', () => {
    let ownerCtx: BrowserContext;
    let ownerPage: Page;
    let deviceCtx: BrowserContext;

    test.beforeAll(async ({ browser }) => {
      test.setTimeout(120_000);
      ({ ownerCtx, ownerPage } = await openOwnerSessionsPage(browser));
      ({ deviceCtx } = await openSecondDevice(browser));
      await refetchSessions(ownerPage);
    });

    test.afterAll(async () => {
      await deviceCtx.close();
      await ownerCtx.close();
    });

    test('revoke button on another session shows confirmation dialog', async () => {
      const revokeBtn = ownerPage.getByRole('button', { name: 'Revoke' }).first();
      await expect(revokeBtn).toBeVisible({ timeout: 10_000 });
      await revokeBtn.click();
      await expect(ownerPage.getByRole('heading', { name: 'Revoke session?' })).toBeVisible();
    });

    test('confirming revoke removes the session from the list', async () => {
      await expect(await revokeFirstOtherSession(ownerPage)).toBe(204);
      await expect.poll(() => getSessionCount(ownerPage), { timeout: 10_000 }).toBe(1);
      await ownerPage.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click();
      await refetchSessions(ownerPage);
      await expect(ownerPage.locator('[data-testid="session-row"]')).toHaveCount(1, {
        timeout: 10_000,
      });
      await expect(
        ownerPage.getByRole('button', { name: 'Sign out all other devices' }),
      ).toHaveCount(0);
    });
  });

  test('revoked session is redirected to /login after reload', async ({ browser }) => {
    test.setTimeout(150_000);
    const { ownerCtx, ownerPage } = await openOwnerSessionsPage(browser);
    const { deviceCtx, page: devicePage } = await openSecondDevice(browser);
    try {
      await refetchSessions(ownerPage);
      await expect(await revokeFirstOtherSession(ownerPage)).toBe(204);
      await expect.poll(() => getSessionCount(ownerPage), { timeout: 10_000 }).toBe(1);
      await refetchSessions(ownerPage);
      await expect(ownerPage.locator('[data-testid="session-row"]')).toHaveCount(1, {
        timeout: 10_000,
      });

      await devicePage.goto('/');
      await expect(devicePage).toHaveURL('/unlock', { timeout: 10_000 });
      await devicePage.getByLabel('Master password').fill(PASSWORD);
      await devicePage.getByRole('button', { name: 'Unlock vault' }).click();
      await expect(devicePage).toHaveURL('/login', { timeout: 30_000 });
    } finally {
      await deviceCtx.close();
      await ownerCtx.close();
    }
  });

  test.describe.serial('bulk sign out flow', () => {
    let ownerCtx: BrowserContext;
    let ownerPage: Page;
    let deviceCtx: BrowserContext;

    test.beforeAll(async ({ browser }) => {
      test.setTimeout(120_000);
      ({ ownerCtx, ownerPage } = await openOwnerSessionsPage(browser));
      ({ deviceCtx } = await openSecondDevice(browser));
      await refetchSessions(ownerPage);
    });

    test.afterAll(async () => {
      await deviceCtx.close();
      await ownerCtx.close();
    });

    test('sign out all other devices shows confirmation dialog', async () => {
      const bulkBtn = ownerPage.getByRole('button', { name: 'Sign out all other devices' });
      await expect(bulkBtn).toBeVisible({ timeout: 10_000 });
      await bulkBtn.click();
      await expect(
        ownerPage.getByRole('heading', { name: 'Sign out all other devices?' }),
      ).toBeVisible();
    });

    test('sign out all other devices removes non-current sessions', async () => {
      await expect(await revokeAllOtherSessions(ownerPage)).toBe(204);
      await expect.poll(() => getSessionCount(ownerPage), { timeout: 15_000 }).toBe(1);
      await ownerPage.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click();
      await refetchSessions(ownerPage);
      await expect(ownerPage.locator('[data-testid="session-row"]')).toHaveCount(1, {
        timeout: 15_000,
      });
      await expect(ownerPage.getByText('This device')).toBeVisible();
      await expect(
        ownerPage.getByRole('button', { name: 'Sign out all other devices' }),
      ).toHaveCount(0);
    });
  });
});
