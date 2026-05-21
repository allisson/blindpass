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
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCreateItem, useVaultItems, type DecryptedItem } from '@/hooks/useVault';
import { useFolders } from '@/hooks/useFolders';
import { session } from '@/lib/session';

export function duplicateTitle(title: string): string {
  return `${title} (copy)`;
}

const itemTypeEnum = z.enum([
  'login',
  'secure_note',
  'payment_card',
  'identity',
  'totp',
  'developer_credential',
  'crypto_wallet',
]);

export const Route = createFileRoute('/_vault/items/new')({
  validateSearch: z.object({
    type: itemTypeEnum.optional(),
    folderId: z.uuid().optional(),
    duplicateFrom: z.uuid().optional(),
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

function buildDuplicateDefaults(source: DecryptedItem): Partial<VaultItem> {
  return { ...source, title: duplicateTitle(source.title) } as Partial<VaultItem>;
}

export function NewItemPage() {
  const navigate = useNavigate();
  const { type, folderId, duplicateFrom } = Route.useSearch();
  const itemsQuery = useVaultItems();

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

  if (duplicateFrom && itemsQuery.isLoading) {
    return (
      <div className="p-4 h-full overflow-auto">
        {breadcrumb}
        <h1 className="text-lg font-semibold text-foreground mb-6">New item</h1>
        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-9 w-full" />
        </div>
      </div>
    );
  }

  const source = duplicateFrom
    ? itemsQuery.data?.find((i) => i.id === duplicateFrom && i.type === type)
    : undefined;

  return (
    <NewItemFormView
      breadcrumb={breadcrumb}
      type={type}
      initialFolderId={source?.folderId ?? folderId ?? undefined}
      defaultValues={source ? buildDuplicateDefaults(source) : undefined}
    />
  );
}

function NewItemFormView({
  breadcrumb,
  type,
  initialFolderId,
  defaultValues,
}: {
  breadcrumb: React.ReactNode;
  type: z.infer<typeof itemTypeEnum>;
  initialFolderId: string | undefined;
  defaultValues: Partial<VaultItem> | undefined;
}) {
  const navigate = useNavigate();
  const createItem = useCreateItem();
  const { data: folders, isError: foldersError } = useFolders();
  const [selectedFolderId, setSelectedFolderId] = useState<string | undefined>(initialFolderId);

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
          <Select
            value={selectedFolderId ?? ''}
            onValueChange={(v) => setSelectedFolderId(v || undefined)}
          >
            <SelectTrigger id="folder-picker">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">No folder</SelectItem>
              {folders.map((f) => (
                <SelectItem key={f.id} value={f.id}>
                  {f.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <div className="rounded-lg border border-border bg-card p-4">
        <ItemForm
          type={type}
          defaultValues={defaultValues}
          onSubmit={handleSubmit}
          onCancel={() => navigate({ to: '/' })}
          submitLabel="Create item"
        />
      </div>
    </div>
  );
}
