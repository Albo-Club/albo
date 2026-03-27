import { Skeleton } from '@/components/ui/skeleton';

export function EmailListSkeleton() {
  return (
    <div className="space-y-1 p-2">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex items-center gap-3 py-2.5 px-3">
          <Skeleton className="h-2 w-2 rounded-full" />
          <Skeleton className="h-4 w-36" />
          <div className="flex-1 flex items-center gap-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 flex-1 max-w-48" />
          </div>
          <Skeleton className="h-3 w-12" />
        </div>
      ))}
    </div>
  );
}
