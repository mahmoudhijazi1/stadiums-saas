import type { ComponentType, ReactNode } from "react";
import { ChevronRight, Clock, MapPin, Repeat } from "lucide-react";
import type { UiLocale } from "@/lib/locale";
import { ui } from "@/lib/copy";
import { ClockRangeText } from "@/components/ui/ltr-isolate";
import { cn } from "cn";
import { ExtendedMark } from "@/modules/booking/ui/extend-form";
import type { UpcomingRowView } from "@/modules/booking/ui/booking-sheet/row-view";

type Icon = ComponentType<{ className?: string; "aria-hidden"?: boolean }>;

const ROW = "flex min-h-14 w-full items-center gap-3 border-b px-4 py-2 text-start last:border-b-0";

function Fact({ icon: Glyph, label, children }: { icon: Icon; label: string; children: ReactNode }) {
  return (
    <div className={ROW}>
      <Glyph aria-hidden className="size-5 shrink-0 text-muted-foreground" />
      <span className="type-secondary shrink-0">{label}</span>
      <span className="min-w-0 flex-1 text-end type-body">{children}</span>
    </div>
  );
}

/**
 * The facts of a game, one grouped card with a 56px row each (icon, muted label, value): the time (day
 * and range, with the extension mark), the pitch (only when the stadium has several), and the weekly
 * series (only for a series; a row with a chevron to the series view).
 */
export function FactsCard({ row, locale, onSeries }: { row: UpcomingRowView; locale: UiLocale; onSeries: () => void }) {
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <Fact icon={Clock} label={ui("owner.factTime", locale)}>
        <span className="inline-flex flex-wrap items-baseline justify-end gap-x-2">
          <span>{row.dateLabel}</span>
          <ClockRangeText text={row.timeRange} />
          <ExtendedMark minutes={row.extendedMinutes} locale={locale} />
          {row.nightHint ? <span className="type-caption">{row.nightHint}</span> : null}
        </span>
      </Fact>
      {row.pitchName ? (
        <Fact icon={MapPin} label={ui("owner.factPitch", locale)}>
          <bdi>{row.pitchName}</bdi>
        </Fact>
      ) : null}
      {row.series ? (
        <button
          type="button"
          onClick={onSeries}
          className={cn(ROW, "outline-none hover:bg-muted/60 focus-visible:ring-[3px] focus-visible:ring-inset focus-visible:ring-ring/50")}
        >
          <Repeat aria-hidden className="size-5 shrink-0 text-muted-foreground" />
          <span className="type-secondary shrink-0">{ui("owner.factWeekly", locale)}</span>
          <span className="min-w-0 flex-1 truncate text-end type-body">{row.series.fact}</span>
          <ChevronRight aria-hidden className="size-5 shrink-0 text-muted-foreground rtl:rotate-180" />
        </button>
      ) : null}
    </div>
  );
}
