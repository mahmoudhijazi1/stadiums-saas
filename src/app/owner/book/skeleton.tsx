import { Skeleton } from "@/components/ui/skeleton";

function SlotChipSkeleton() {
  return (
    <div className="flex min-h-16 flex-col items-start justify-center gap-2 rounded-xl border bg-card px-3 py-3 shadow-sm">
      <Skeleton className="h-5 w-24 rounded-md" />
      <Skeleton className="h-3.5 w-12 rounded-md" />
    </div>
  );
}

export function BookSlotsSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-hidden>
      <div className="flex flex-col gap-3">
        <Skeleton className="h-5 w-28 self-start rounded-md" />
        <div className="grid grid-cols-2 gap-2">
          <SlotChipSkeleton />
          <SlotChipSkeleton />
          <SlotChipSkeleton />
          <SlotChipSkeleton />
        </div>
      </div>
    </div>
  );
}
