import { Skeleton } from "@/components/ui/skeleton";

function SlotChipSkeleton() {
  return (
    <div className="flex min-h-20 w-full items-center gap-2.5 rounded-xl border border-muted-foreground/40 bg-card px-3 py-3">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <Skeleton className="h-5 w-16 rounded-md" />
        <Skeleton className="h-3 w-12 rounded-md" />
      </div>
      <div className="my-1 w-px self-stretch bg-muted-foreground/40" />
      <div className="flex min-w-0 flex-1 flex-col items-end gap-0.5">
        <Skeleton className="h-3 w-10 rounded-md" />
        <Skeleton className="h-3 w-6 rounded-md" />
      </div>
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
