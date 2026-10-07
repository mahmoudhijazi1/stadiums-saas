import { ChevronRight, CircleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ClockRangeText, LtrIsolate } from "@/components/ui/ltr-isolate";
import type { UiLocale } from "@/lib/locale";
import { ui } from "@/lib/ui-copy";
import { cn } from "cn";

/** What the compact row needs from a booking still owed from an earlier day. */
export type DebtRowView = {
  id: string;
  /** "Yesterday", a weekday, or the date (see `formatEarlierDayLabel`). */
  dayLabel: string;
  timeRange: string;
  requesterName: string;
  /** What is still owed, compact USD without the sign ("30"). */
  owedUsd: string;
  pitchName: string | null;
};

/**
 * One owed game from an earlier day, as a compact row with an amber edge. Never a full
 * booking card, so it cannot be mistaken for one of today's games. Tapping opens the same
 * booking sheet as the cards.
 */
export function DebtRow({
  row,
  mayCollect,
  highlighted,
  open,
  onOpen,
  locale,
}: {
  row: DebtRowView;
  mayCollect: boolean;
  highlighted: boolean;
  open: boolean;
  onOpen: (id: string) => void;
  locale: UiLocale;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-lg border border-s-4 border-s-owed bg-card",
        (open || highlighted) && "ring-2 ring-inset ring-action-ink",
      )}
    >
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={ui("owner.openBooking", locale)}
        onClick={() => onOpen(row.id)}
        className="flex min-h-14 min-w-0 flex-1 cursor-pointer flex-col items-start gap-0.5 bg-transparent px-3 py-2 text-start outline-none focus-visible:ring-[3px] focus-visible:ring-inset focus-visible:ring-ring/50"
      >
        <span className="flex items-baseline gap-2 text-sm">
          <span className="font-medium">{row.dayLabel}</span>
          <ClockRangeText text={row.timeRange} className="text-sm text-muted-foreground" />
          {row.pitchName ? (
            <span className="truncate text-muted-foreground">{row.pitchName}</span>
          ) : null}
        </span>
        <span className="flex w-full items-center gap-2 text-sm">
          <span className="min-w-0 flex-1 truncate">
            <bdi>{row.requesterName}</bdi>
          </span>
          <span className="inline-flex shrink-0 items-center gap-1 font-medium text-owed">
            <CircleAlert aria-hidden className="size-4 shrink-0" />
            <span>{ui("owner.owedWord", locale)}</span>
            <LtrIsolate>${row.owedUsd}</LtrIsolate>
          </span>
        </span>
      </button>
      {mayCollect ? (
        <Button
          type="button"
          size="sm"
          className="me-3 min-h-11 shrink-0"
          onClick={() => onOpen(row.id)}
        >
          {ui("owner.collect", locale)}
        </Button>
      ) : (
        <ChevronRight
          aria-hidden
          className="me-3 size-5 shrink-0 text-muted-foreground rtl:rotate-180"
        />
      )}
    </div>
  );
}
