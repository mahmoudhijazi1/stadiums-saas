import { Button } from "@/components/ui/button";
import { ClockRangeText } from "@/components/ui/ltr-isolate";
import { LtrIsolate } from "@/components/ui/ltr-isolate";
import type { UiLocale } from "@/lib/locale";
import { ui } from "@/lib/ui-copy";
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
        <>
          <span>{row.dayLabel}</span>
          <ClockRangeText text={row.timeRange} />
          {row.pitchName ? <span>{row.pitchName}</span> : null}
        </>
      }
      pill={mayCollect ? undefined : <OwedPill amountUsd={row.owedUsd} word={ui("owner.dueShort", locale)} />}
      action={
        mayCollect ? (
          <Button
            type="button"
            size="sm"
            className="min-h-11 shrink-0"
            onClick={() => onOpen(row.id)}
          >
            {ui("owner.collect", locale)} <LtrIsolate>${row.owedUsd}</LtrIsolate>
          </Button>
        ) : undefined
      }
      onOpen={() => onOpen(row.id)}
      highlighted={highlighted}
      open={open}
    />
  );
}
