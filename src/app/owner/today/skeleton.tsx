import { Skeleton } from "@/components/ui/skeleton";

export function TodayListsSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="h-4 w-28" />
      <Skeleton className="h-36 w-full rounded-xl" />
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-36 w-full rounded-xl" />
    </div>
  );
}
