import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { ClockText } from "@/components/ui/ltr-isolate";
import type { UiLocale } from "@/lib/locale";
import { ui } from "@/lib/copy";

/** The nearest free time from now, on another day: where the link goes and how it reads. */
export type NearestLink = { dateKey: string; dayLabel: string; startLocal: string };

/** One line for a day with nothing left to request, and the link to the nearest free time. */
export function NoFreeTimes({ nearest, locale }: { nearest: NearestLink | null; locale: UiLocale }) {
  return (
    <p className="type-body flex flex-wrap items-center gap-x-2">
      <span className="type-strong">{ui("public.noFreeTimes", locale)}</span>
      {nearest ? (
        <>
          <span aria-hidden>·</span>
          <Link
            href={{ pathname: "/", query: { date: nearest.dateKey } }}
            scroll={false}
            className="type-label inline-flex min-h-11 items-center gap-1 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            {ui("public.nearest", locale)}: {nearest.dayLabel} <ClockText text={nearest.startLocal} />
            <ChevronRight aria-hidden className="size-4 rtl:-scale-x-100" />
          </Link>
        </>
      ) : null}
    </p>
  );
}
