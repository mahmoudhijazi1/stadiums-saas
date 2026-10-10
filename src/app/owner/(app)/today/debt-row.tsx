import { ClockRangeText } from "@/components/ui/ltr-isolate";
import { LtrIsolate } from "@/components/ui/ltr-isolate";
import type { UiLocale } from "@/lib/locale";
import { ui } from "@/lib/copy";
import { BookingRow, OwedPill } from "@/app/owner/booking-row";

/** What the debt variant needs from a booking still owed from an earlier day. */
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
 * One owed game from an earlier day: the debt variant of BookingRow. Line 2 starts with
 * the relative day. The body opens the booking sheet; the Collect button is a separate,
 * 44px target 12px away from it (it opens the same sheet, where the payment is taken).
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
    <BookingRow
      variant="debt"
      title={<bdi>{row.requesterName}</bdi>}
      meta={
        // One muted line: "Yesterday · 4:00–5:00 PM" (the time range is LTR-isolated, digits tabular).
        <span className="tabular-nums">
          {row.dayLabel}
          <span aria-hidden> · </span>
          <ClockRangeText text={row.timeRange} />
          {row.pitchName ? (
            <>
              <span aria-hidden> · </span>
              {row.pitchName}
            </>
          ) : null}
        </span>
      }
      pill={mayCollect ? undefined : <OwedPill amountUsd={row.owedUsd} word={ui("owner.dueShort", locale)} />}
      action={
        mayCollect ? (
          // A tonal button (never the lime fill, which is for the centre + and primary saves):
          // owed colours, 36px pill inside a 44px hit area.
          <button
            type="button"
            onClick={() => onOpen(row.id)}
            className="inline-flex min-h-11 shrink-0 items-center outline-none focus-visible:[&>span]:ring-[3px] focus-visible:[&>span]:ring-ring/50"
          >
            <span className="inline-flex h-9 items-center gap-1 rounded-full bg-owed-subtle px-4 type-button text-owed whitespace-nowrap">
              {ui("owner.collect", locale)} <LtrIsolate>${row.owedUsd}</LtrIsolate>
            </span>
          </button>
        ) : undefined
      }
      onOpen={() => onOpen(row.id)}
      highlighted={highlighted}
      open={open}
    />
  );
}
