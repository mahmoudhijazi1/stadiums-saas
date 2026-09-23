import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "cn";

/**
 * Public-page loading shapes. Pieces are separate so later UI
 * (banners, a form under a slot, extra pitches) can reuse them.
 * Alignment uses logical start/end — follows dir="rtl" and dir="ltr".
 */

/** Short bar parked at inline-start (right in RTL, left in LTR). */
function StartLine({ className }: { className?: string }) {
  return (
    <Skeleton className={cn("h-4 w-24 self-start rounded-md", className)} />
  );
}

/** One time+price chip — same min-h and padding as the live slot card. */
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

/** Wrapping 2-col grid of slot chips. */
function SlotGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="slot-cols grid w-full grid-cols-2 gap-2.5 md:grid-cols-3">
      {Array.from({ length: count }, (_, index) => (
        <SlotChipSkeleton key={index} />
      ))}
    </div>
  );
}

/** Pitch name + that pitch’s slot grid. */
function PitchHoursSkeleton({ slots = 6 }: { slots?: number }) {
  return (
    <div className="flex flex-col gap-3">
      <StartLine className="h-5 w-28" />
      <SlotGridSkeleton count={slots} />
    </div>
  );
}

/**
 * Same-week day-chip row (7 cells). Not the hours Suspense fallback —
 * chips stay mounted — exported for a later full-page load.
 */
function DayChipsSkeleton() {
  return (
    <ul className="-mx-4 flex gap-1.5 overflow-x-auto px-4 md:mx-0 md:grid md:grid-cols-7 md:overflow-visible md:px-0 lg:grid-cols-[repeat(7,minmax(0,1fr))_auto]">
      {Array.from({ length: 7 }, (_, index) => (
        <li key={index} className="w-[4.75rem] shrink-0 md:w-auto md:min-w-0">
          <Skeleton className="h-14 w-full rounded-xl" />
        </li>
      ))}
      <li className="hidden w-14 shrink-0 lg:block">
        <Skeleton className="h-14 w-14 rounded-xl" />
      </li>
    </ul>
  );
}

/** Hours Suspense fallback: two pitches of slot chips. */
function PublicHoursSkeleton({
  pitches = 2,
  slotsPerPitch = 6,
}: {
  pitches?: number;
  slotsPerPitch?: number;
}) {
  return (
    <div className="flex flex-col gap-6 lg:grid lg:grid-cols-2" aria-hidden>
      {Array.from({ length: pitches }, (_, index) => (
        <PitchHoursSkeleton key={index} slots={slotsPerPitch} />
      ))}
    </div>
  );
}

export {
  StartLine,
  SlotChipSkeleton,
  SlotGridSkeleton,
  PitchHoursSkeleton,
  DayChipsSkeleton,
  PublicHoursSkeleton,
};
