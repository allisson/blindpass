import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TrashPage } from './trash';
import type { DecryptedTrashedItem } from '@/hooks/useVault';

const mocks = vi.hoisted(() => ({
  useTrashItems: vi.fn(),
  useVaultList: vi.fn(),
  useRestoreItem: vi.fn(),
  usePurgeItem: vi.fn(),
  useEmptyTrash: vi.fn(),
  restoreMutate: vi.fn(),
  purgeMutate: vi.fn(),
  emptyMutate: vi.fn(),
}));

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (config: unknown) => config,
}));

vi.mock('@/components/vault/ItemCard', () => ({
  getItemSubtitle: (item: { type: string; [key: string]: unknown }) => {
    if (item.type === 'login') return String(item.username ?? '');
    if (item.type === 'secure_note') return String(item.content ?? '');
    if (item.type === 'payment_card') return String(item.cardholderName ?? '');
    if (item.type === 'identity') return `${item.firstName ?? ''} ${item.lastName ?? ''}`.trim();
    if (item.type === 'totp') return [item.issuer, item.accountName].filter(Boolean).join(' · ');
    return '';
  },
}));

vi.mock('framer-motion', () => ({
  motion: {
    div: ({
      children,
      custom,
      initial,
      animate,
      variants,
      ...props
    }: React.ComponentProps<'div'> & {
      custom?: unknown;
      initial?: unknown;
      animate?: unknown;
      variants?: unknown;
    }) => {
      void initial;
      void animate;
      if (
        variants &&
        typeof variants === 'object' &&
        'visible' in variants &&
        typeof variants.visible === 'function'
      ) {
        variants.visible(typeof custom === 'number' ? custom : 0);
      }
      return <div {...props}>{children}</div>;
    },
  },
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
  },
}));

vi.mock('@/hooks/useVault', () => ({
  useTrashItems: mocks.useTrashItems,
  useVaultList: mocks.useVaultList,
  useRestoreItem: mocks.useRestoreItem,
  usePurgeItem: mocks.usePurgeItem,
  useEmptyTrash: mocks.useEmptyTrash,
}));

function loginItem(overrides: Partial<DecryptedTrashedItem> = {}): DecryptedTrashedItem {
  return {
    id: 'item-1',
    vaultId: 'vault-1',
    deletedAt: '2026-04-20T12:00:00.000Z',
    type: 'login',
    title: 'GitHub',
    username: 'dev@example.com',
    password: 'secret',
    ...overrides,
  } as DecryptedTrashedItem;
}

function renderTrash(
  options: {
    items?: DecryptedTrashedItem[];
    isLoading?: boolean;
    isError?: boolean;
    restorePending?: boolean;
    purgePending?: boolean;
    emptyPending?: boolean;
  } = {},
) {
  const items = 'items' in options ? options.items : [loginItem()];
  const {
    isLoading = false,
    isError = false,
    restorePending = false,
    purgePending = false,
    emptyPending = false,
  } = options;

  mocks.useTrashItems.mockReturnValue({ data: items, isLoading, isError });
  mocks.useVaultList.mockReturnValue([
    { id: 'vault-1', name: 'Personal' },
    { id: 'vault-2', name: 'Work' },
  ]);
  mocks.useRestoreItem.mockReturnValue({
    mutateAsync: mocks.restoreMutate,
    isPending: restorePending,
  });
  mocks.usePurgeItem.mockReturnValue({
    mutateAsync: mocks.purgeMutate,
    isPending: purgePending,
  });
  mocks.useEmptyTrash.mockReturnValue({
    mutateAsync: mocks.emptyMutate,
    isPending: emptyPending,
  });

  return render(<TrashPage />);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.restoreMutate.mockResolvedValue(undefined);
  mocks.purgeMutate.mockResolvedValue(undefined);
  mocks.emptyMutate.mockResolvedValue(undefined);
});

describe('TrashPage', () => {
  describe('deleted-at formatting', () => {
    const NOW = new Date('2026-05-08T15:00:00.000Z').getTime();

    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(NOW);
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('shows "today" for items deleted within the same day', () => {
      renderTrash({
        items: [loginItem({ id: 'today', deletedAt: '2026-05-08T08:00:00.000Z' })],
      });
      const row = screen.getByTestId('trash-row-today');
      expect(within(row).getByText(/today/)).toBeInTheDocument();
    });

    it('shows "yesterday" for items deleted exactly one day ago', () => {
      renderTrash({
        items: [loginItem({ id: 'y', deletedAt: '2026-05-07T08:00:00.000Z' })],
      });
      const row = screen.getByTestId('trash-row-y');
      expect(within(row).getByText(/yesterday/)).toBeInTheDocument();
    });

    it('shows "Xd ago" for items deleted within the last week', () => {
      renderTrash({
        items: [loginItem({ id: 'r', deletedAt: '2026-05-05T08:00:00.000Z' })],
      });
      const row = screen.getByTestId('trash-row-r');
      expect(within(row).getByText(/3d ago/)).toBeInTheDocument();
    });

    it('omits a relative label for items older than a week', () => {
      renderTrash({
        items: [loginItem({ id: 'old', deletedAt: '2026-04-01T12:00:00.000Z' })],
      });
      const row = screen.getByTestId('trash-row-old');
      expect(within(row).queryByText(/today|yesterday|d ago/i)).not.toBeInTheDocument();
    });

    it('falls back gracefully for unparseable timestamps', () => {
      renderTrash({
        items: [loginItem({ id: 'bad', deletedAt: 'not-a-date' })],
      });
      const row = screen.getByTestId('trash-row-bad');
      expect(within(row).getByText(/not-a-dat/)).toBeInTheDocument();
    });
  });

  it('search matches items whose source vault has been deleted', async () => {
    const user = userEvent.setup();
    renderTrash({
      items: [
        loginItem({ id: 'orphan', vaultId: 'missing', title: 'Orphan' }),
        loginItem({ id: 'kept', vaultId: 'vault-1', title: 'Kept' }),
      ],
    });

    await user.type(screen.getByLabelText('Search trash'), 'orph');
    expect(screen.getByText('Orphan')).toBeInTheDocument();
    expect(screen.queryByText('Kept')).not.toBeInTheDocument();
  });

  it('renders detailed rows with title, subtitle, source vault, and deleted date', () => {
    renderTrash({
      items: [loginItem({ title: 'GitHub', username: 'dev@example.com' })],
    });

    const row = screen.getByTestId('trash-row-item-1');
    expect(within(row).getByText('GitHub')).toBeInTheDocument();
    expect(within(row).getByText('dev@example.com')).toBeInTheDocument();
    expect(within(row).getByText('Personal')).toBeInTheDocument();
    expect(within(row).getByText(/2026-04-20/)).toBeInTheDocument();
  });

  it('falls back when subtitle and source vault are missing', () => {
    renderTrash({
      items: [loginItem({ id: 'item-missing', vaultId: 'missing-vault', username: '' })],
    });

    const row = screen.getByTestId('trash-row-item-missing');
    expect(within(row).getByText('No subtitle')).toBeInTheDocument();
    expect(within(row).getByText('(deleted vault)')).toBeInTheDocument();
  });

  it('restore confirmation surfaces "deleted vault" wording when source vault is missing', async () => {
    const user = userEvent.setup();
    renderTrash({
      items: [loginItem({ id: 'item-missing', vaultId: 'missing-vault', title: 'Orphan' })],
    });

    await user.click(screen.getByRole('button', { name: 'Restore Orphan' }));

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText(/deleted vault/i)).toBeInTheDocument();
  });

  it('search filters by title, subtitle, and source vault', async () => {
    const user = userEvent.setup();
    renderTrash({
      items: [
        loginItem({
          id: 'item-1',
          title: 'GitHub',
          username: 'dev@example.com',
          vaultId: 'vault-1',
        }),
        loginItem({
          id: 'item-2',
          title: 'Payroll',
          username: 'finance@example.com',
          vaultId: 'vault-2',
        }),
      ],
    });

    const search = screen.getByLabelText('Search trash');
    await user.type(search, 'finance');
    expect(screen.getByText('Payroll')).toBeInTheDocument();
    expect(screen.queryByText('GitHub')).not.toBeInTheDocument();

    await user.clear(search);
    await user.type(search, 'personal');
    expect(screen.getByText('GitHub')).toBeInTheDocument();
    expect(screen.queryByText('Payroll')).not.toBeInTheDocument();

    await user.clear(search);
    await user.type(search, 'pay');
    expect(screen.getByText('Payroll')).toBeInTheDocument();
    expect(screen.queryByText('GitHub')).not.toBeInTheDocument();

    await user.click(screen.getByLabelText('Clear trash search'));
    expect(screen.getByText('GitHub')).toBeInTheDocument();
  });

  it('shows a no-results state when search matches no trashed items', async () => {
    const user = userEvent.setup();
    renderTrash({ items: [loginItem({ title: 'GitHub', username: 'dev@example.com' })] });

    await user.type(screen.getByLabelText('Search trash'), 'missing');

    expect(screen.getByText('No matches')).toBeInTheDocument();
    expect(screen.queryByText('GitHub')).not.toBeInTheDocument();
  });

  it('sort controls reorder by newest, oldest, and title', async () => {
    const user = userEvent.setup();
    renderTrash({
      items: [
        loginItem({ id: 'item-a', title: 'Beta', deletedAt: '2026-04-10T12:00:00.000Z' }),
        loginItem({ id: 'item-b', title: 'Alpha', deletedAt: '2026-04-25T12:00:00.000Z' }),
      ],
    });

    const rows = () => screen.getAllByTestId(/trash-row-/).map((row) => row.textContent);
    expect(rows()[0]).toContain('Alpha');

    await user.selectOptions(screen.getByLabelText('Sort trash'), 'deleted-asc');
    expect(rows()[0]).toContain('Beta');

    await user.selectOptions(screen.getByLabelText('Sort trash'), 'title-asc');
    expect(rows()[0]).toContain('Alpha');
  });

  it('empty state appears when trash has no items and empty trash button is hidden', () => {
    renderTrash({ items: [] });

    expect(screen.getByText('Trash is empty')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Empty trash' })).not.toBeInTheDocument();
  });

  it('error state appears when trash query fails', () => {
    renderTrash({ items: undefined, isError: true });

    expect(screen.getByRole('alert')).toHaveTextContent('Failed to load trash');
    expect(screen.getByText('Recovery actions are unavailable.')).toBeInTheDocument();
  });

  it('loading state keeps recovery controls unavailable', () => {
    renderTrash({ items: [], isLoading: true });

    expect(screen.getByRole('heading', { name: 'Trash' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Empty trash' })).not.toBeInTheDocument();
    expect(screen.queryByTestId('trash-table')).not.toBeInTheDocument();
  });

  it('handles missing trash data without rendering rows', () => {
    renderTrash({ items: undefined, isLoading: false, isError: false });

    expect(screen.getByRole('heading', { name: 'Trash' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Empty trash' })).not.toBeInTheDocument();
    expect(screen.queryByTestId('trash-table')).not.toBeInTheDocument();
  });

  it('restore button opens confirmation, cancel keeps item, confirm calls restore', async () => {
    const user = userEvent.setup();
    renderTrash({ items: [loginItem({ id: 'item-1', vaultId: 'vault-1', title: 'GitHub' })] });

    await user.click(screen.getByRole('button', { name: 'Restore GitHub' }));
    expect(screen.getByRole('heading', { name: 'Restore item?' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(mocks.restoreMutate).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Restore GitHub' }));
    await user.click(screen.getByRole('button', { name: 'Restore' }));
    expect(mocks.restoreMutate).toHaveBeenCalledWith({ id: 'item-1', vaultId: 'vault-1' });

    vi.clearAllMocks();
    const view = renderTrash({
      items: [loginItem({ id: 'item-1', vaultId: 'vault-1', title: 'GitHub' })],
      restorePending: true,
    });

    // Pending state surfaces on the row only while its dialog is open.
    const rowButton = within(view.container).getByRole('button', { name: 'Restore GitHub' });
    await user.click(rowButton);
    expect(rowButton).toBeDisabled();
    expect(rowButton).toHaveTextContent('Restoring…');
  });

  it('permanent delete opens confirmation, cancel keeps item, confirm calls purge', async () => {
    const user = userEvent.setup();
    renderTrash({ items: [loginItem({ id: 'item-1', vaultId: 'vault-1', title: 'GitHub' })] });

    await user.click(screen.getByRole('button', { name: 'Delete GitHub permanently' }));
    expect(screen.getByRole('heading', { name: 'Delete permanently?' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(mocks.purgeMutate).not.toHaveBeenCalled();
    expect(screen.getByText('GitHub')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Delete GitHub permanently' }));
    await user.click(screen.getByRole('button', { name: 'Delete permanently' }));
    expect(mocks.purgeMutate).toHaveBeenCalledWith({ id: 'item-1', vaultId: 'vault-1' });
  });

  it('permanent delete confirmation shows pending state', async () => {
    const user = userEvent.setup();
    renderTrash({
      items: [loginItem({ id: 'item-1', vaultId: 'vault-1', title: 'GitHub' })],
      purgePending: true,
    });

    await user.click(screen.getByRole('button', { name: 'Delete GitHub permanently' }));

    expect(screen.getByRole('button', { name: 'Deleting…' })).toBeDisabled();
  });

  it('empty trash requires confirmation when non-empty', async () => {
    const user = userEvent.setup();
    renderTrash({ items: [loginItem()] });

    await user.click(screen.getByRole('button', { name: 'Empty trash' }));
    expect(screen.getByRole('heading', { name: 'Empty trash?' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(mocks.emptyMutate).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Empty trash' }));
    await user.click(screen.getByRole('button', { name: 'Empty trash' }));
    expect(mocks.emptyMutate).toHaveBeenCalled();
  });

  it('empty trash confirmation uses singular item wording', async () => {
    const user = userEvent.setup();
    renderTrash({ items: [loginItem()] });

    await user.click(screen.getByRole('button', { name: 'Empty trash' }));

    expect(
      screen.getByText(
        'All 1 item and their version history will be permanently deleted. This cannot be undone.',
      ),
    ).toBeInTheDocument();
  });

  it('empty trash confirmation uses plural item wording', async () => {
    const user = userEvent.setup();
    renderTrash({ items: [loginItem(), loginItem({ id: 'item-2', title: 'GitLab' })] });

    await user.click(screen.getByRole('button', { name: 'Empty trash' }));

    expect(
      screen.getByText(
        'All 2 items and their version history will be permanently deleted. This cannot be undone.',
      ),
    ).toBeInTheDocument();
  });

  it('empty trash confirmation shows pending state', async () => {
    const user = userEvent.setup();
    const view = renderTrash({ items: [loginItem()] });

    await user.click(screen.getByRole('button', { name: 'Empty trash' }));

    mocks.useEmptyTrash.mockReturnValue({
      mutateAsync: mocks.emptyMutate,
      isPending: true,
    });
    view.rerender(<TrashPage />);

    expect(screen.getByRole('button', { name: 'Emptying…' })).toBeDisabled();
  });

  describe('keyboard navigation', () => {
    function buildItems() {
      return [
        loginItem({ id: 'a', title: 'Alpha', deletedAt: '2026-04-25T12:00:00.000Z' }),
        loginItem({ id: 'b', title: 'Beta', deletedAt: '2026-04-20T12:00:00.000Z' }),
        loginItem({ id: 'c', title: 'Gamma', deletedAt: '2026-04-15T12:00:00.000Z' }),
      ];
    }

    function getRows() {
      return screen.getAllByTestId(/^trash-row-/) as HTMLElement[];
    }

    it("'/' anywhere on the page focuses the search input", () => {
      renderTrash({ items: buildItems() });

      fireEvent.keyDown(document.body, { key: '/' });

      expect(screen.getByLabelText('Search trash')).toHaveFocus();
    });

    it("'/' is ignored while focus is inside an input or textarea", () => {
      renderTrash({ items: buildItems() });

      const input = document.createElement('input');
      const textarea = document.createElement('textarea');
      const select = document.createElement('select');
      document.body.append(input, textarea, select);
      input.focus();

      fireEvent.keyDown(input, { key: '/' });
      expect(screen.getByLabelText('Search trash')).not.toHaveFocus();

      textarea.focus();
      fireEvent.keyDown(textarea, { key: '/' });
      expect(screen.getByLabelText('Search trash')).not.toHaveFocus();

      select.focus();
      fireEvent.keyDown(select, { key: '/' });
      expect(screen.getByLabelText('Search trash')).not.toHaveFocus();

      input.remove();
      textarea.remove();
      select.remove();
    });

    it('ArrowDown from search jumps to first row', () => {
      renderTrash({ items: buildItems() });
      const search = screen.getByLabelText('Search trash');
      search.focus();

      fireEvent.keyDown(search, { key: 'ArrowDown' });

      expect(getRows()[0]).toHaveFocus();
    });

    it('non-ArrowDown keys in search do not move focus to rows', () => {
      renderTrash({ items: buildItems() });
      const search = screen.getByLabelText('Search trash');
      search.focus();

      fireEvent.keyDown(search, { key: 'a' });
      expect(search).toHaveFocus();
    });

    it('ArrowDown / j move focus down rows; ArrowUp / k move up; ArrowUp at first row returns to search', () => {
      renderTrash({ items: buildItems() });
      const rows = getRows();
      rows[0].focus();

      fireEvent.keyDown(rows[0], { key: 'ArrowDown' });
      expect(rows[1]).toHaveFocus();

      fireEvent.keyDown(rows[1], { key: 'j' });
      expect(rows[2]).toHaveFocus();

      // Past last row — clamped to last row.
      fireEvent.keyDown(rows[2], { key: 'ArrowDown' });
      expect(rows[2]).toHaveFocus();

      fireEvent.keyDown(rows[2], { key: 'k' });
      expect(rows[1]).toHaveFocus();

      fireEvent.keyDown(rows[1], { key: 'ArrowUp' });
      expect(rows[0]).toHaveFocus();

      fireEvent.keyDown(rows[0], { key: 'ArrowUp' });
      expect(screen.getByLabelText('Search trash')).toHaveFocus();
    });

    it('Escape on a row returns focus to search', () => {
      renderTrash({ items: buildItems() });
      const row = getRows()[0];
      row.focus();

      fireEvent.keyDown(row, { key: 'Escape' });

      expect(screen.getByLabelText('Search trash')).toHaveFocus();
    });

    it('Enter, r, and R on a row open the restore dialog', () => {
      renderTrash({ items: buildItems() });
      const rows = getRows();

      rows[0].focus();
      fireEvent.keyDown(rows[0], { key: 'Enter' });
      expect(screen.getByRole('heading', { name: 'Restore item?' })).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

      rows[1].focus();
      fireEvent.keyDown(rows[1], { key: 'r' });
      expect(screen.getByRole('heading', { name: 'Restore item?' })).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

      rows[2].focus();
      fireEvent.keyDown(rows[2], { key: 'R' });
      expect(screen.getByRole('heading', { name: 'Restore item?' })).toBeInTheDocument();
    });

    it('Delete and Backspace on a row open the purge dialog', () => {
      renderTrash({ items: buildItems() });
      const rows = getRows();

      rows[0].focus();
      fireEvent.keyDown(rows[0], { key: 'Delete' });
      expect(screen.getByRole('heading', { name: 'Delete permanently?' })).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

      rows[1].focus();
      fireEvent.keyDown(rows[1], { key: 'Backspace' });
      expect(screen.getByRole('heading', { name: 'Delete permanently?' })).toBeInTheDocument();
    });

    it('action keys fired from inside a row button do not open dialogs', () => {
      renderTrash({ items: buildItems() });
      const button = screen.getByRole('button', { name: 'Restore Alpha' });
      button.focus();

      fireEvent.keyDown(button, { key: 'r' });
      expect(screen.queryByRole('heading', { name: 'Restore item?' })).not.toBeInTheDocument();

      fireEvent.keyDown(button, { key: 'Delete' });
      expect(
        screen.queryByRole('heading', { name: 'Delete permanently?' }),
      ).not.toBeInTheDocument();
    });

    it('navigation keys still work when focus is on a row button', () => {
      renderTrash({ items: buildItems() });
      const button = screen.getByRole('button', { name: 'Restore Alpha' });
      button.focus();

      fireEvent.keyDown(button, { key: 'ArrowDown' });

      expect(getRows()[1]).toHaveFocus();
    });

    it('keyboard events outside any row are ignored', () => {
      renderTrash({ items: buildItems() });
      const table = screen.getByTestId('trash-table');

      fireEvent.keyDown(table, { key: 'r' });

      expect(screen.queryByRole('heading', { name: 'Restore item?' })).not.toBeInTheDocument();
    });

    it('unknown keys on a row are ignored', () => {
      renderTrash({ items: buildItems() });
      const row = getRows()[0];
      row.focus();

      fireEvent.keyDown(row, { key: 'x' });

      expect(screen.queryByRole('heading', { name: 'Restore item?' })).not.toBeInTheDocument();
      expect(
        screen.queryByRole('heading', { name: 'Delete permanently?' }),
      ).not.toBeInTheDocument();
    });
  });

  describe('dialog dismissal via onOpenChange', () => {
    it('Escape on the restore dialog clears the restore target', async () => {
      const user = userEvent.setup();
      renderTrash({ items: [loginItem({ id: 'item-1', title: 'GitHub' })] });

      await user.click(screen.getByRole('button', { name: 'Restore GitHub' }));
      expect(screen.getByRole('heading', { name: 'Restore item?' })).toBeInTheDocument();

      await user.keyboard('{Escape}');

      expect(screen.queryByRole('heading', { name: 'Restore item?' })).not.toBeInTheDocument();
    });

    it('Escape on the purge dialog clears the purge target', async () => {
      const user = userEvent.setup();
      renderTrash({ items: [loginItem({ id: 'item-1', title: 'GitHub' })] });

      await user.click(screen.getByRole('button', { name: 'Delete GitHub permanently' }));
      expect(screen.getByRole('heading', { name: 'Delete permanently?' })).toBeInTheDocument();

      await user.keyboard('{Escape}');

      expect(
        screen.queryByRole('heading', { name: 'Delete permanently?' }),
      ).not.toBeInTheDocument();
    });
  });
});
