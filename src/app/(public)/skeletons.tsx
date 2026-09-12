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

/** Wrapping 2-col grid of slot chips. */
function SlotGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-2">
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
    <ul className="flex gap-1.5">
      {Array.from({ length: 6 }, (_, index) => (
        <li key={index} className="min-w-0 flex-1">
          <Skeleton className="h-14 w-full rounded-xl" />
        </li>
      ))}
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
    <div className="flex flex-col gap-6" aria-hidden>
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
