import type { UiLocale } from "@/lib/locale";
import { ui, uiCount } from "@/lib/copy";
import { ClockRangeText } from "@/components/ui/ltr-isolate";
import { CountedPhrase } from "@/modules/booking/ui/notify-list";
import { BookingRow, StatusPill, variantOf } from "@/modules/booking/ui/booking-row";
import { ExtendedMark } from "@/modules/booking/ui/extend-form";
import type { UpcomingRowView } from "@/modules/booking/ui/booking-sheet/row-view";

export function UpcomingRows({
  rows,
  openId,
  onOpen,
  onOpenInterests,
  locale,
  highlight,
  rowKeyPrefix,
}: {
  rows: UpcomingRowView[];
  openId: string | null;
  onOpen: (id: string) => void;
  onOpenInterests: (id: string) => void;
  locale: UiLocale;
  highlight?: string;
  rowKeyPrefix: string;
}) {
  return (
    <ul className="flex flex-col gap-2">
      {rows.map((row) => (
        <li key={`${rowKeyPrefix}-${row.id}`} id={`${rowKeyPrefix}-${row.id}`}>
          <BookingRow
            variant={variantOf(row.display)}
            title={<bdi>{row.requesterName}</bdi>}
            meta={
              <>
                <ClockRangeText text={row.timeRange} />
                <ExtendedMark minutes={row.extendedMinutes} locale={locale} />
                {row.series ? (
                  <span role="img" aria-label={ui("owner.seriesCardMark", locale)} className="text-muted-foreground">
                    ↻
                  </span>
                ) : null}
                {row.pitchName ? <span>{row.pitchName}</span> : null}
                {row.nightHint ? <span>{row.nightHint}</span> : null}
              </>
            }
            pill={
              <StatusPill
                display={row.display}
                amountUsd={row.displayAmountUsd}
                locale={locale}
              />
            }
            onOpen={() => onOpen(row.id)}
            open={openId === row.id}
            highlighted={highlight === row.id}
            footer={
              row.interested.length > 0 ? (
                <button
                  type="button"
                  className="inline-flex min-h-11 items-center rounded-full border px-3 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  onClick={() => onOpenInterests(row.id)}
                >
                  <CountedPhrase
                    text={uiCount("owner.interested", row.interested.length, locale)}
                  />
                </button>
              ) : undefined
            }
          />
        </li>
      ))}
    </ul>
  );
}
