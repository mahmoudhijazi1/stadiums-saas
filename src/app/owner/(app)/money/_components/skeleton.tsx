import { Skeleton } from "@/components/ui/skeleton";

export function MoneySkeleton() {
  return (
    <div className="flex flex-col gap-8">
      <Skeleton className="h-48 w-full rounded-xl" />
      <Skeleton className="h-10 w-32" />
      <Skeleton className="h-16 w-full rounded-xl" />
      <Skeleton className="h-16 w-full rounded-xl" />
    </div>
  );
}
