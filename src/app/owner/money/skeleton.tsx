import { Skeleton } from "@/components/ui/skeleton";

export function MoneySkeleton() {
  return (
    <div className="flex flex-col gap-8">
      <Skeleton className="h-24 w-full rounded-xl" />
      <Skeleton className="h-16 w-full rounded-xl" />
      <Skeleton className="h-16 w-full rounded-xl" />
    </div>
  );
}
