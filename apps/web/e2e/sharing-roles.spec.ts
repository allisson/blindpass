import { test, expect } from '@playwright/test';
import {
  registerAndCaptureKey,
  uniqueUsername,
  createVault,
  createVaultItem,
  captureBundle,
  unlockVault,
} from './helpers';

const PASSWORD = 'sharingtest123!';

test.describe('Sharing Roles', () => {
  test('owner shares as viewer and editor; verifies permissions', async ({ browser }) => {
    test.setTimeout(600_000);

    const OWNER_USERNAME = uniqueUsername('owner');
    const VIEWER_USERNAME = uniqueUsername('viewer');
    const EDITOR_USERNAME = uniqueUsername('editor');

    const ownerContext = await browser.newContext();
    const viewerContext = await browser.newContext();
    const editorContext = await browser.newContext();

    const ownerPage = await ownerContext.newPage();
    const viewerPage = await viewerContext.newPage();
    const editorPage = await editorContext.newPage();

    try {
      // 1. Register users sequentially to stay under auth route rate limits
      await registerAndCaptureKey(ownerPage, OWNER_USERNAME, PASSWORD);
      await registerAndCaptureKey(viewerPage, VIEWER_USERNAME, PASSWORD);
      await registerAndCaptureKey(editorPage, EDITOR_USERNAME, PASSWORD);

      const [, viewerBundle, editorBundle] = await Promise.all([
        captureBundle(ownerPage),
        captureBundle(viewerPage),
        captureBundle(editorPage),
      ]);

      // 2. Owner creates a vault and an item
      await createVault(ownerPage, 'Shared Team Vault');
      await createVaultItem(ownerPage, 'login', 'Shared Credential', {
        Username: 'team-user',
        Password: 'team-password',
      });
      await ownerPage.getByRole('link', { name: 'Vault', exact: true }).click();
      await ownerPage.waitForURL('/', { timeout: 10_000 });

      // 3. Owner shares with Viewer (viewer role)
      await ownerPage.getByTestId('vault-picker-trigger').click();
      await ownerPage
        .getByRole('dialog')
        .locator('div')
        .filter({ has: ownerPage.getByRole('button', { name: 'Shared Team Vault', exact: true }) })
        .last()
        .getByTestId('share-vault-button')
        .click();
      await ownerPage.getByLabel('Share with (username)').fill(VIEWER_USERNAME);
      // Role 'viewer' is default
      await ownerPage.getByRole('button', { name: 'Continue' }).click();
      await expect(ownerPage.getByText('Verify recipient identity')).toBeVisible(); // verification dialog
      await ownerPage.getByRole('button', { name: 'Share' }).click();
      await expect(ownerPage.getByText(VIEWER_USERNAME)).toBeVisible();
      await ownerPage.getByRole('button', { name: 'Close' }).click();

      // 4. Owner shares with Editor (editor role)
      await ownerPage.getByTestId('vault-picker-trigger').click();
      await ownerPage
        .getByRole('dialog')
        .locator('div')
        .filter({ has: ownerPage.getByRole('button', { name: 'Shared Team Vault', exact: true }) })
        .last()
        .getByTestId('share-vault-button')
        .click();
      await ownerPage.getByLabel('Share with (username)').fill(EDITOR_USERNAME);
      await ownerPage.getByRole('radio', { name: 'editor' }).click();
      await ownerPage.getByRole('button', { name: 'Continue' }).click();
      await expect(ownerPage.getByText('Verify recipient identity')).toBeVisible();
      await ownerPage.getByRole('button', { name: 'Share' }).click();
      await expect(ownerPage.getByText(EDITOR_USERNAME)).toBeVisible();
      await ownerPage.getByRole('button', { name: 'Close' }).click();

      // 5. Viewer checks access (Read-Only)
      await unlockVault(viewerPage, viewerBundle, PASSWORD);
      await viewerPage.getByTestId('vault-picker-trigger').click();
      await viewerPage.getByRole('button', { name: 'Shared Team Vault' }).click();
      await expect(viewerPage.getByText('Shared Credential')).toBeVisible();

      // Check UI restrictions for Viewer
      await expect(viewerPage.getByLabel('New item')).not.toBeVisible();
      await viewerPage.getByText('Shared Credential').click();
      await expect(viewerPage.getByTestId('action-bar-edit')).not.toBeVisible();
      await expect(viewerPage.getByTestId('action-bar-more')).not.toBeVisible();

      // 6. Editor checks access (Read/Write)
      await unlockVault(editorPage, editorBundle, PASSWORD);
      await editorPage.getByTestId('vault-picker-trigger').click();
      await editorPage.getByRole('button', { name: 'Shared Team Vault' }).click();
      await expect(editorPage.getByText('Shared Credential')).toBeVisible();

      // Check UI access for Editor
      await expect(editorPage.getByLabel('New item')).toBeVisible();
      await editorPage.getByText('Shared Credential').click();
      await expect(editorPage.getByTestId('action-bar-edit')).toBeVisible();

      // Editor creates an item
      await editorPage.getByRole('link', { name: 'Vault', exact: true }).click();
      await createVaultItem(editorPage, 'secure_note', 'Editor Note', {
        Content: 'Created by editor',
      });
      await expect(editorPage.getByRole('heading', { name: 'Editor Note' })).toBeVisible();

      // 7. Owner sees item created by Editor — re-switch vault to trigger qc.removeQueries +
      // immediate vaultSync. Re-selecting the already-active shared vault is a no-op, so switch
      // to My Vault first, then switch back.
      await ownerPage.getByTestId('vault-picker-trigger').click();
      await ownerPage
        .getByRole('dialog')
        .getByRole('button', { name: 'My Vault', exact: true })
        .click();
      await expect(ownerPage.getByTestId('vault-picker-trigger')).toHaveAttribute(
        'data-active-vault',
        'My Vault',
      );
      await ownerPage.getByTestId('vault-picker-trigger').click();
      await ownerPage
        .getByRole('dialog')
        .getByRole('button', { name: 'Shared Team Vault' })
        .click();
      await expect(ownerPage.getByTestId('vault-list').getByText('Editor Note')).toBeVisible({
        timeout: 15_000,
      });

      // 8. Editor deletes an item
      await editorPage.getByTestId('action-bar-more').click();
      await editorPage.getByTestId('action-bar-delete').click();
      await editorPage
        .getByRole('dialog')
        .filter({ hasText: 'Move to trash?' })
        .getByRole('button', { name: 'Move to trash' })
        .click();
      await expect(editorPage.getByTestId('vault-list').getByText('Editor Note')).not.toBeVisible({
        timeout: 15_000,
      });

      // 9. Owner sees deletion — switch away and back to trigger qc.removeQueries + immediate
      // vaultSync; re-selecting the active shared vault is a no-op and would leave the 5-min poll
      // interval as the only refresh.
      await ownerPage.getByTestId('vault-picker-trigger').click();
      await ownerPage
        .getByRole('dialog')
        .getByRole('button', { name: 'My Vault', exact: true })
        .click();
      await expect(ownerPage.getByTestId('vault-picker-trigger')).toHaveAttribute(
        'data-active-vault',
        'My Vault',
      );
      await ownerPage.getByTestId('vault-picker-trigger').click();
      await ownerPage
        .getByRole('dialog')
        .getByRole('button', { name: 'Shared Team Vault' })
        .click();
      await expect(ownerPage.getByTestId('vault-list').getByText('Editor Note')).not.toBeVisible({
        timeout: 15_000,
      });

      // 9. Editor sees the shared vault as a shared row, not an owned/renamable one.
      await editorPage.getByTestId('vault-picker-trigger').click();
      await expect(editorPage.getByTestId('leave-vault-button')).toBeVisible();
      await editorPage.keyboard.press('Escape');

      // 10. Viewer leaves the shared vault — regression for the confirmation dialog being
      // unreachable when opened from inside the vault picker drawer.
      // Use the testid directly: the viewer has exactly one shared vault so only one leave button.
      await viewerPage.getByRole('link', { name: 'Vault', exact: true }).click();
      await viewerPage.waitForURL('/', { timeout: 10_000 });
      await viewerPage.getByTestId('vault-picker-trigger').click();
      await viewerPage.getByTestId('leave-vault-button').click();
      const confirmLeave = viewerPage.getByTestId('confirm-leave-button');
      await expect(confirmLeave).toBeEnabled();
      await confirmLeave.click();

      // 11. Vault disappears from viewer's list
      await expect(viewerPage.getByTestId('confirm-leave-button')).not.toBeVisible({
        timeout: 10_000,
      });
      await viewerPage.getByTestId('vault-picker-trigger').click();
      await expect(viewerPage.locator('div').filter({ hasText: 'Shared Team Vault' })).toHaveCount(
        0,
      );
      await viewerPage.keyboard.press('Escape');

      // 12. Owner's share list no longer contains the viewer
      await ownerPage.getByTestId('vault-picker-trigger').click();
      await ownerPage
        .getByRole('dialog')
        .locator('div')
        .filter({ has: ownerPage.getByRole('button', { name: 'Shared Team Vault', exact: true }) })
        .last()
        .getByTestId('share-vault-button')
        .click();
      await expect(ownerPage.getByText(EDITOR_USERNAME)).toBeVisible();
      await expect(ownerPage.getByText(VIEWER_USERNAME)).not.toBeVisible({ timeout: 15_000 });
    } finally {
      await ownerPage.close();
      await viewerPage.close();
      await editorPage.close();
      await ownerContext.close();
      await viewerContext.close();
      await editorContext.close();
    }
  });
});
