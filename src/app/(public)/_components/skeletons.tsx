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

/** Wrapping 2-col grid of slot chips. */
function SlotGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="flex w-full flex-col gap-2">
      {Array.from({ length: count }, (_, index) => (
        <Skeleton key={index} className="h-14 w-full rounded-lg" />
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
  SlotGridSkeleton,
  PitchHoursSkeleton,
  DayChipsSkeleton,
  PublicHoursSkeleton,
};
