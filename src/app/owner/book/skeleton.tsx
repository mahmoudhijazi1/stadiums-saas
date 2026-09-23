import { Skeleton } from "@/components/ui/skeleton";

function SlotChipSkeleton() {
  return (
    <div className="flex min-h-[96px] w-full flex-col justify-between rounded-[var(--radius-card)] bg-inverse px-[14px] py-3 dark:bg-surface">
      <div className="flex flex-col gap-1">
        <Skeleton className="h-6 w-16 rounded-md" />
        <Skeleton className="h-3 w-20 rounded-md" />
      </div>
      <div className="flex items-center justify-between gap-2">
        <Skeleton className="h-4 w-12 rounded-md" />
        <Skeleton className="h-5 w-8 rounded-full" />
      </div>
    </div>
  );
}

export function BookSlotsSkeleton() {
  return (
    <div className="flex flex-col gap-6 lg:grid lg:grid-cols-2" aria-hidden>
      <div className="flex flex-col gap-3">
        <Skeleton className="h-5 w-28 self-start rounded-md" />
        <div className="slot-cols grid w-full grid-cols-2 gap-2.5 md:grid-cols-3">
          <SlotChipSkeleton />
          <SlotChipSkeleton />
          <SlotChipSkeleton />
          <SlotChipSkeleton />
        </div>
      </div>
    </div>
  );
}
