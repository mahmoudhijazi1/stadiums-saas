import { ChevronRight } from "lucide-react";
import type { UpcomingRowView } from "@/modules/booking/ui/booking-sheet/row-view";

/** The weekly series line under the time; tapping it opens the series step. */
export function SeriesRow({ row, onSeries }: { row: UpcomingRowView; onSeries: () => void }) {
  if (!row.series) return null;
  return (
        <button
          type="button"
          onClick={onSeries}
          className="flex min-h-11 w-full items-center justify-between gap-3 rounded-lg border px-3 type-secondary text-start outline-none hover:bg-muted/60 focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <span className="min-w-0">{row.series.line}</span>
          <ChevronRight aria-hidden className="size-4 shrink-0 text-muted-foreground rtl:rotate-180" />
        </button>
  );
}
