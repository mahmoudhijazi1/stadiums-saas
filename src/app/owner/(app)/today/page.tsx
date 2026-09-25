import { Suspense } from "react";
import {
  queryString,
  requireOwnerMembership,
} from "@/app/owner/shared";
import { OwnerToday } from "./lists";
import { TodayListsSkeleton } from "./skeleton";
import { getUiLocale } from "@/lib/get-ui-locale";
import type { OutcomeKind } from "@/modules/booking/application/load-outcome-notify";

function outcomeKind(value: string | undefined): OutcomeKind | undefined {
  if (value === "cancelled" || value === "no_show" || value === "due") {
    return value;
  }
  return undefined;
}

export default async function OwnerTodayPage({
  searchParams,
}: PageProps<"/owner/today">) {
  const params = await searchParams;
  const membership = await requireOwnerMembership();
  const locale = await getUiLocale();
  const query = params as {
    highlight?: string | string[];
    date?: string | string[];
    notify?: string | string[];
    bookingId?: string | string[];
  };
  const highlight = queryString(query.highlight);
  const date = queryString(query.date);
  const notify = outcomeKind(queryString(query.notify));
  const bookingId = queryString(query.bookingId);

  return (
    <section className="flex flex-col gap-4">
      <Suspense fallback={<TodayListsSkeleton />}>
        <OwnerToday
          membership={membership}
          locale={locale}
          highlight={highlight}
          date={date}
          notify={notify}
          bookingId={bookingId}
        />
      </Suspense>
    </section>
  );
}
