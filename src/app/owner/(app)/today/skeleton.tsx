import { Skeleton } from "@/components/ui/skeleton";

export function TodayListsSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="h-4 w-28" />
      <Skeleton className="h-28 w-full rounded-xl" />
      <Skeleton className="h-4 w-20" />
      <Skeleton className="h-16 w-full rounded-xl" />
      <Skeleton className="h-16 w-full rounded-xl" />
    </div>
  );
}
