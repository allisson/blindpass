import { Link, createFileRoute, useNavigate, redirect } from '@tanstack/react-router';
import { ChevronRight } from 'lucide-react';
import { z } from 'zod';
import { useState } from 'react';
import type { VaultItem } from '@blindpass/vault';
import { toast } from 'sonner';
import { ItemForm } from '@/components/vault/ItemForm';
import { ItemTypePicker } from '@/components/vault/ItemTypePicker';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useCreateItem } from '@/hooks/useVault';
import { useFolders } from '@/hooks/useFolders';
import { session } from '@/lib/session';

export const Route = createFileRoute('/_vault/items/new')({
  validateSearch: z.object({
    type: z
      .enum([
        'login',
        'secure_note',
        'payment_card',
        'identity',
        'totp',
        'developer_credential',
        'crypto_wallet',
      ])
      .optional(),
    folderId: z.uuid().optional(),
  }),
  beforeLoad: () => {
    const s = session.get();
    const isReadOnly = s ? s.vaults.get(s.activeVaultId)?.role === 'viewer' : false;
    if (isReadOnly) {
      throw redirect({ to: '/' });
    }
  },
  component: NewItemPage,
});

function NewItemPage() {
  const navigate = useNavigate();
  const { type, folderId } = Route.useSearch();
  const createItem = useCreateItem();
  const { data: folders, isError: foldersError } = useFolders();
  const [selectedFolderId, setSelectedFolderId] = useState<string | undefined>(folderId);

  async function handleSubmit(data: VaultItem) {
    let result: { id: string };
    try {
      result = await createItem.mutateAsync({ vaultItem: data, folderId: selectedFolderId });
    } catch {
      return;
    }
    toast.success('Item created');
    navigate({ to: '/$itemId', params: { itemId: result.id } });
  }

  const breadcrumb = (
    <nav className="flex items-center gap-1.5 text-xs text-muted-foreground mb-4">
      <Link to="/" className="hover:text-foreground transition-colors">
        Vault
      </Link>
      <ChevronRight className="w-3 h-3" />
      <span className="text-foreground">New item</span>
    </nav>
  );

  if (!type) {
    return (
      <div className="p-4 h-full overflow-auto">
        {breadcrumb}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-lg font-semibold text-foreground">New item</h1>
          <Button variant="outline" size="sm" onClick={() => navigate({ to: '/' })}>
            Cancel
          </Button>
        </div>
        <ItemTypePicker
          onSelect={(t) => navigate({ to: '/items/new', search: { type: t, folderId } })}
        />
      </div>
    );
  }

  return (
    <div className="p-4 h-full overflow-auto">
      {breadcrumb}
      <h1 className="text-lg font-semibold text-foreground mb-6">New item</h1>
      {foldersError && <p className="text-sm text-destructive mb-4">Could not load folders</p>}
      {!foldersError && folders && folders.length > 0 && (
        <div className="flex items-center gap-3 mb-4">
          <Label htmlFor="folder-picker" className="text-muted-foreground whitespace-nowrap">
            Folder
          </Label>
          <select
            id="folder-picker"
            value={selectedFolderId ?? ''}
            onChange={(e) => setSelectedFolderId(e.target.value || undefined)}
            className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="">No folder</option>
            {folders.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="rounded-lg border border-border bg-card p-4">
        <ItemForm
          type={type}
          onSubmit={handleSubmit}
          onCancel={() => navigate({ to: '/' })}
          submitLabel="Create item"
        />
      </div>
    </div>
  );
}
