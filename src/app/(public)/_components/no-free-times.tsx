import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { formatCivilDate, type CivilDate } from "@/modules/venue/domain/availability";
import { weekdayLabel } from "@/modules/venue/ui/weekday-label";
import { LtrIsolate } from "@/components/ui/ltr-isolate";
import type { UiLocale } from "@/lib/locale";
import { ui } from "@/lib/copy";

/** A day with nothing left to request, and (when there is one) a link to the next day with a free time. */
export function NoFreeTimes({ nextFree, locale }: { nextFree: CivilDate | null; locale: UiLocale }) {
  return (
    <div className="flex flex-col items-start gap-2 rounded-lg border border-line bg-surface p-4">
      <p className="type-strong">{ui("public.noFreeTimes", locale)}</p>
      {nextFree ? (
        <Link
          href={{ pathname: "/", query: { date: formatCivilDate(nextFree) } }}
          scroll={false}
          className="type-label inline-flex min-h-11 items-center gap-1 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          {ui("public.nextFree", locale)} {weekdayLabel(nextFree, locale)} <LtrIsolate>{String(nextFree.day)}</LtrIsolate>
          <ChevronRight aria-hidden className="size-4 rtl:-scale-x-100" />
        </Link>
      ) : null}
    </div>
  );
}
