import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { VaultItem } from '@blindpass/vault';
import type { DecryptedItem } from '@/hooks/useVault';
import { NewItemPage, duplicateTitle, Route } from './new';

const mocks = vi.hoisted(() => ({
  search: vi.fn<() => Record<string, unknown>>(),
  navigate: vi.fn(),
  useVaultItems: vi.fn(),
  useCreateItem: vi.fn(),
  useFolders: vi.fn(),
  itemFormProps: vi.fn(),
  sessionGet: vi.fn<() => unknown>(),
}));

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (config: { component: React.ComponentType }) => ({
    ...config,
    useSearch: () => mocks.search(),
    useParams: () => ({}),
  }),
  useNavigate: () => mocks.navigate,
  Link: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
    to?: string;
  }) => <a className={className}>{children}</a>,
  redirect: vi.fn(),
}));

vi.mock('@/hooks/useVault', async () => {
  const actual = await vi.importActual<typeof import('@/hooks/useVault')>('@/hooks/useVault');
  return {
    ...actual,
    useVaultItems: mocks.useVaultItems,
    useCreateItem: mocks.useCreateItem,
  };
});

vi.mock('@/hooks/useFolders', () => ({
  useFolders: mocks.useFolders,
}));

vi.mock('@/lib/session', () => ({
  session: { get: () => mocks.sessionGet() },
}));

vi.mock('@/components/vault/ItemForm', () => ({
  ItemForm: (props: {
    type: string;
    defaultValues?: Record<string, unknown>;
    submitLabel?: string;
    onSubmit: (data: VaultItem) => Promise<void>;
    onCancel: () => void;
  }) => {
    mocks.itemFormProps(props);
    return (
      <div data-testid="mock-item-form">
        <span data-testid="form-type">{props.type}</span>
        <span data-testid="form-title">{String(props.defaultValues?.title ?? '')}</span>
        <span data-testid="form-username">{String(props.defaultValues?.username ?? '')}</span>
        <button
          data-testid="mock-form-submit"
          onClick={() =>
            void props.onSubmit({
              type: 'login',
              title: 'X',
              username: 'u',
              password: 'p',
              url: '',
            } as VaultItem)
          }
        >
          submit
        </button>
        <button data-testid="mock-form-cancel" onClick={() => props.onCancel()}>
          cancel
        </button>
      </div>
    );
  },
}));

vi.mock('@/components/vault/ItemTypePicker', () => ({
  ItemTypePicker: ({ onSelect }: { onSelect: (t: string) => void }) => (
    <button data-testid="mock-type-picker" onClick={() => onSelect('login')}>
      pick
    </button>
  ),
}));

vi.mock('@/components/ui/select', () => ({
  Select: ({
    onValueChange,
    children,
  }: {
    onValueChange: (v: string) => void;
    children: React.ReactNode;
  }) => (
    <div>
      <button data-testid="mock-folder-change" onClick={() => onValueChange('folder-B')}>
        change
      </button>
      <button data-testid="mock-folder-clear" onClick={() => onValueChange('')}>
        clear
      </button>
      {children}
    </div>
  ),
  SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectItem: ({ children, value }: { children: React.ReactNode; value: string }) => (
    <div data-value={value}>{children}</div>
  ),
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectValue: () => null,
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

function loginItem(overrides: Partial<DecryptedItem> = {}): DecryptedItem {
  return {
    id: '11111111-1111-1111-1111-111111111111',
    folderId: null,
    type: 'login',
    title: 'GitHub',
    username: 'dev@example.com',
    password: 'secret',
    url: 'https://github.com',
    ...overrides,
  } as DecryptedItem;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.useCreateItem.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
  mocks.useFolders.mockReturnValue({ data: [], isError: false });
  mocks.sessionGet.mockReturnValue(null);
});

describe('duplicateTitle', () => {
  it('appends " (copy)" suffix', () => {
    expect(duplicateTitle('GitHub')).toBe('GitHub (copy)');
  });

  it('leaves empty string yielding " (copy)"', () => {
    expect(duplicateTitle('')).toBe(' (copy)');
  });

  it('does not strip an existing suffix', () => {
    expect(duplicateTitle('GitHub (copy)')).toBe('GitHub (copy) (copy)');
  });
});

describe('NewItemPage (duplicate flow)', () => {
  it('renders skeleton while items are loading and duplicateFrom is set', () => {
    mocks.search.mockReturnValue({ type: 'login', duplicateFrom: loginItem().id });
    mocks.useVaultItems.mockReturnValue({ data: undefined, isLoading: true });

    render(<NewItemPage />);

    expect(screen.queryByTestId('mock-item-form')).not.toBeInTheDocument();
  });

  it('pre-fills ItemForm with a " (copy)" title and the source payload', () => {
    const source = loginItem();
    mocks.search.mockReturnValue({ type: 'login', duplicateFrom: source.id });
    mocks.useVaultItems.mockReturnValue({ data: [source], isLoading: false });

    render(<NewItemPage />);

    expect(screen.getByTestId('form-type')).toHaveTextContent('login');
    expect(screen.getByTestId('form-title')).toHaveTextContent('GitHub (copy)');
    expect(screen.getByTestId('form-username')).toHaveTextContent('dev@example.com');

    const props = mocks.itemFormProps.mock.calls.at(-1)?.[0] as {
      defaultValues?: { password?: string; url?: string };
    };
    expect(props.defaultValues?.password).toBe('secret');
    expect(props.defaultValues?.url).toBe('https://github.com');
  });

  it('renders an empty form when the source id resolves to nothing', () => {
    mocks.search.mockReturnValue({
      type: 'login',
      duplicateFrom: '22222222-2222-2222-2222-222222222222',
    });
    mocks.useVaultItems.mockReturnValue({ data: [loginItem()], isLoading: false });

    render(<NewItemPage />);

    expect(screen.getByTestId('mock-item-form')).toBeInTheDocument();
    expect(screen.getByTestId('form-title')).toHaveTextContent('');
  });

  it('renders an empty form when no duplicateFrom is supplied', () => {
    mocks.search.mockReturnValue({ type: 'login' });
    mocks.useVaultItems.mockReturnValue({ data: [], isLoading: false });

    render(<NewItemPage />);

    expect(screen.getByTestId('form-title')).toHaveTextContent('');
  });

  it('renders the type picker when no type is in the URL', () => {
    mocks.search.mockReturnValue({});
    mocks.useVaultItems.mockReturnValue({ data: [], isLoading: false });

    render(<NewItemPage />);

    expect(screen.getByTestId('mock-type-picker')).toBeInTheDocument();
  });

  it('cancels back to home from the type-picker screen', async () => {
    const user = userEvent.setup();
    mocks.search.mockReturnValue({});
    mocks.useVaultItems.mockReturnValue({ data: [], isLoading: false });

    render(<NewItemPage />);

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(mocks.navigate).toHaveBeenCalledWith({ to: '/' });
  });

  it('swallows submission errors and does not navigate away', async () => {
    const mutateAsync = vi.fn().mockRejectedValue(new Error('boom'));
    mocks.useCreateItem.mockReturnValue({ mutateAsync, isPending: false });
    mocks.search.mockReturnValue({ type: 'login' });
    mocks.useVaultItems.mockReturnValue({ data: [], isLoading: false });

    render(<NewItemPage />);

    fireEvent.click(screen.getByTestId('mock-form-submit'));

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalled();
    });
    expect(mocks.navigate).not.toHaveBeenCalled();
  });

  it('beforeLoad redirects read-only viewers to home', () => {
    mocks.sessionGet.mockReturnValue({
      activeVaultId: 'v1',
      vaults: new Map([['v1', { role: 'viewer' }]]),
    });
    const cfg = Route as unknown as { beforeLoad: () => void };
    expect(() => cfg.beforeLoad()).toThrow();
  });

  it('beforeLoad is a no-op for editors', () => {
    mocks.sessionGet.mockReturnValue({
      activeVaultId: 'v1',
      vaults: new Map([['v1', { role: 'editor' }]]),
    });
    const cfg = Route as unknown as { beforeLoad: () => void };
    expect(() => cfg.beforeLoad()).not.toThrow();
  });

  it('forwards form submission to useCreateItem with the picked folderId', async () => {
    const mutateAsync = vi.fn().mockResolvedValue({ id: 'created-id' });
    mocks.useCreateItem.mockReturnValue({ mutateAsync, isPending: false });
    const source = loginItem({ folderId: 'folder-A' });
    mocks.search.mockReturnValue({ type: 'login', duplicateFrom: source.id });
    mocks.useVaultItems.mockReturnValue({ data: [source], isLoading: false });

    render(<NewItemPage />);

    fireEvent.click(screen.getByTestId('mock-form-submit'));

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith(expect.objectContaining({ folderId: 'folder-A' }));
    });
    expect(mocks.navigate).toHaveBeenCalledWith({
      to: '/$itemId',
      params: { itemId: 'created-id' },
    });
  });

  it('navigates home when the form is cancelled', async () => {
    const user = userEvent.setup();
    mocks.search.mockReturnValue({ type: 'login' });
    mocks.useVaultItems.mockReturnValue({ data: [], isLoading: false });

    render(<NewItemPage />);

    await user.click(screen.getByTestId('mock-form-cancel'));

    expect(mocks.navigate).toHaveBeenCalledWith({ to: '/' });
  });

  it('navigates from the type picker to the typed new-item URL', async () => {
    const user = userEvent.setup();
    mocks.search.mockReturnValue({ folderId: 'folder-A' });
    mocks.useVaultItems.mockReturnValue({ data: [], isLoading: false });

    render(<NewItemPage />);

    await user.click(screen.getByTestId('mock-type-picker'));

    expect(mocks.navigate).toHaveBeenCalledWith({
      to: '/items/new',
      search: { type: 'login', folderId: 'folder-A' },
    });
  });

  it('updates the picked folder when the user changes it', async () => {
    const user = userEvent.setup();
    const mutateAsync = vi.fn().mockResolvedValue({ id: 'created-id' });
    mocks.useCreateItem.mockReturnValue({ mutateAsync, isPending: false });
    const source = loginItem({ folderId: 'folder-A' });
    mocks.search.mockReturnValue({ type: 'login', duplicateFrom: source.id });
    mocks.useVaultItems.mockReturnValue({ data: [source], isLoading: false });
    mocks.useFolders.mockReturnValue({
      data: [
        { id: 'folder-A', name: 'Work' },
        { id: 'folder-B', name: 'Personal' },
      ],
      isError: false,
    });

    render(<NewItemPage />);

    await user.click(screen.getByTestId('mock-folder-change'));
    fireEvent.click(screen.getByTestId('mock-form-submit'));

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith(expect.objectContaining({ folderId: 'folder-B' }));
    });
  });

  it('clears the picked folder when set to empty', async () => {
    const user = userEvent.setup();
    const mutateAsync = vi.fn().mockResolvedValue({ id: 'created-id' });
    mocks.useCreateItem.mockReturnValue({ mutateAsync, isPending: false });
    const source = loginItem({ folderId: 'folder-A' });
    mocks.search.mockReturnValue({ type: 'login', duplicateFrom: source.id });
    mocks.useVaultItems.mockReturnValue({ data: [source], isLoading: false });
    mocks.useFolders.mockReturnValue({
      data: [{ id: 'folder-A', name: 'Work' }],
      isError: false,
    });

    render(<NewItemPage />);

    await user.click(screen.getByTestId('mock-folder-clear'));
    fireEvent.click(screen.getByTestId('mock-form-submit'));

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith(expect.objectContaining({ folderId: undefined }));
    });
  });
});

// Reference the exported Route to keep the import explicit at the test surface.
void Route;
