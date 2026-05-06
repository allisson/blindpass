import { Link, createFileRoute, useNavigate, redirect } from '@tanstack/react-router';
import { ChevronRight } from 'lucide-react';
import type { VaultItem } from '@blindpass/vault';
import { toast } from 'sonner';
import { ItemForm } from '@/components/vault/ItemForm';
import { Skeleton } from '@/components/ui/skeleton';
import { useUpdateItem, useVaultItems } from '@/hooks/useVault';
import { session } from '@/lib/session';

export const Route = createFileRoute('/_vault/$itemId_/edit')({
  beforeLoad: ({ params }) => {
    const s = session.get();
    const isReadOnly = s ? s.vaults.get(s.activeVaultId)?.role === 'viewer' : false;
    if (isReadOnly) {
      throw redirect({ to: '/$itemId', params: { itemId: params.itemId } });
    }
  },
  component: EditItemPage,
});

function EditItemPage() {
  const { itemId } = Route.useParams();
  const navigate = useNavigate();
  const { data: items, isLoading } = useVaultItems();
  const updateItem = useUpdateItem();

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-80 rounded-lg" />
      </div>
    );
  }

  const item = items?.find((i) => i.id === itemId);
  if (!item) return <div className="p-6 text-sm text-muted-foreground">Item not found.</div>;

  async function handleSubmit(data: VaultItem) {
    await updateItem.mutateAsync({ id: itemId, vaultItem: data });
    toast.success('Changes saved');
    navigate({ to: '/$itemId', params: { itemId } });
  }

  return (
    <div className="p-4 md:p-6 h-full overflow-auto">
      <nav className="flex items-center gap-1.5 text-xs text-muted-foreground mb-4">
        <Link to="/$itemId" params={{ itemId }} className="hover:text-foreground transition-colors">
          {item.title}
        </Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-foreground">Edit</span>
      </nav>
      <h1 className="text-lg font-semibold text-foreground mb-6">Edit item</h1>
      <div className="rounded-lg border border-border bg-card p-4 md:p-6">
        <ItemForm
          key={item.id}
          type={item.type}
          defaultValues={item}
          onSubmit={handleSubmit}
          onCancel={() => navigate({ to: '/$itemId', params: { itemId } })}
          submitLabel="Save changes"
        />
      </div>
    </div>
  );
}
