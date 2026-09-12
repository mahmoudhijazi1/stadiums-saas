import { Skeleton } from "@/components/ui/skeleton";

export function BookSlotsSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="h-5 w-24" />
      <Skeleton className="h-40 w-full rounded-xl" />
    </div>
  );
}
