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

      // 3. Owner shares with Viewer (viewer role)
      await ownerPage.getByTestId('vault-picker-trigger').click();
      await ownerPage
        .locator('div')
        .filter({ hasText: /^Shared Team Vault$/ })
        .getByTestId('share-vault-button')
        .click();
      await ownerPage.getByLabel('Share with (username)').fill(VIEWER_USERNAME);
      // Role 'viewer' is default
      await ownerPage.getByRole('button', { name: 'Share' }).click();
      await expect(ownerPage.getByText('Verify recipient identity')).toBeVisible(); // verification dialog
      await ownerPage.getByRole('button', { name: 'Share', exact: true }).click();
      await expect(ownerPage.getByText(VIEWER_USERNAME)).toBeVisible();
      await ownerPage.getByRole('button', { name: 'Close' }).click();

      // 4. Owner shares with Editor (editor role)
      await ownerPage.getByTestId('vault-picker-trigger').click();
      await ownerPage
        .locator('div')
        .filter({ hasText: /^Shared Team Vault$/ })
        .getByTestId('share-vault-button')
        .click();
      await ownerPage.getByLabel('Share with (username)').fill(EDITOR_USERNAME);
      await ownerPage.getByRole('button', { name: 'editor' }).click();
      await ownerPage.getByRole('button', { name: 'Share' }).click();
      await expect(ownerPage.getByText('Verify recipient identity')).toBeVisible();
      await ownerPage.getByRole('button', { name: 'Share', exact: true }).click();
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
      await editorPage.getByRole('link', { name: 'Vault' }).click();
      await createVaultItem(editorPage, 'secure_note', 'Editor Note', {
        Content: 'Created by editor',
      });
      await expect(editorPage.getByRole('heading', { name: 'Editor Note' })).toBeVisible();

      // 7. Owner sees item created by Editor — re-switch vault to trigger qc.removeQueries +
      // immediate vaultSync (same pattern as step 9; goto('/') would lose in-memory vault key)
      await ownerPage.getByTestId('vault-picker-trigger').click();
      await ownerPage
        .locator('[data-slot="popover-content"]')
        .getByRole('button', { name: 'Shared Team Vault' })
        .click();
      await ownerPage
        .getByTestId('vault-list')
        .getByText('Editor Note')
        .first()
        .click({ timeout: 30_000 });
      await expect(ownerPage.getByRole('main').getByText('Created by editor')).toBeVisible({
        timeout: 15_000,
      });

      // 8. Editor deletes an item
      await editorPage.getByTestId('action-bar-more').click();
      await editorPage.getByTestId('action-bar-delete').click();
      await editorPage.getByRole('dialog').getByRole('button', { name: 'Move to trash' }).click();
      await expect(editorPage.getByTestId('vault-list').getByText('Editor Note')).not.toBeVisible({
        timeout: 15_000,
      });

      // 9. Owner sees deletion — re-switch vault to trigger qc.removeQueries + immediate vaultSync,
      // otherwise the 5-min poll interval would outlast the assertion timeout
      await ownerPage.getByTestId('vault-picker-trigger').click();
      await ownerPage
        .locator('[data-slot="popover-content"]')
        .getByRole('button', { name: 'Shared Team Vault' })
        .click();
      await expect(ownerPage.getByTestId('vault-list').getByText('Editor Note')).not.toBeVisible({
        timeout: 15_000,
      });

      // 9. Editor cannot rename vault — scope to shared vault row; unscoped selector would also
      // match rename buttons on the editor's own (non-shared) vaults
      await editorPage.getByTestId('vault-picker-trigger').click();
      await expect(
        editorPage
          .locator('div')
          .filter({ hasText: /^Shared Team Vault$/ })
          .getByTestId('rename-vault-button'),
      ).not.toBeVisible();
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
