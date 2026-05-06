import { Skeleton } from '@/components/ui/skeleton';

export function ItemCardSkeleton() {
  return (
    <div
      className="flex items-center gap-3 px-3 py-2.5 rounded-lg"
      aria-hidden="true"
      data-testid="item-card-skeleton"
    >
      <Skeleton className="w-8 h-8 rounded-lg shrink-0" />
      <div className="min-w-0 flex-1 space-y-1.5">
        <Skeleton className="h-3 w-2/3 rounded" />
        <Skeleton className="h-2.5 w-1/2 rounded" />
      </div>
      <Skeleton className="w-5 h-5 rounded shrink-0" />
    </div>
  );
}
