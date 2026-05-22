import type { DecryptedItem } from '@/hooks/useVault';
import { ItemCard } from './ItemCard';

interface Props {
  items: DecryptedItem[];
}

export function RecentlyViewedSection({ items }: Props) {
  if (items.length === 0) return null;
  return (
    <div data-testid="recently-viewed-section">
      <div className="px-4 pt-3 pb-1 text-[11px] font-bold tracking-[0.06em] text-muted-foreground uppercase">
        Recently Viewed
      </div>
      {items.map((item) => (
        <ItemCard key={item.id} item={item} />
      ))}
      <div className="h-px bg-border my-1" />
    </div>
  );
}
