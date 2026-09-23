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
    <ul className="day-strip">
      {Array.from({ length: 7 }, (_, index) => (
        <li key={index}>
          <Skeleton className="h-14 w-full rounded-xl" />
        </li>
      ))}
      <li>
        <Skeleton className="h-14 w-full rounded-xl" />
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
