import { Suspense } from "react";
import {
  civilDateInTimeZone,
  formatCivilDate,
} from "@/modules/venue/domain/availability";
import { BOOKINGS_CREATE, can } from "@/modules/access/domain/can";
import { OwnerBookSlots } from "./slots";
import { parseOwnerBookOn } from "./date";
import { BookSlotsSkeleton } from "./skeleton";
import {
  OWNER_TIME_ZONE,
  queryString,
  requireOwnerMembership,
} from "@/app/owner/shared";
import { OwnerBackLink } from "@/app/owner/back-link";
import { DayChips } from "@/components/day-chips";
import { EmptyState } from "@/components/ui/empty-state";
import { getUiLocale } from "@/lib/get-ui-locale";
import { ui } from "@/lib/ui-copy";

export default async function OwnerBookPage({
  searchParams,
}: PageProps<"/owner/book">) {
  const params = await searchParams;
  const membership = await requireOwnerMembership();
  const locale = await getUiLocale();

  if (!can(membership, BOOKINGS_CREATE)) {
    return (
      <EmptyState
        title={ui("empty.noCreate", locale)}
        next={ui("empty.noCreateNext", locale)}
      />
    );
  }

  const todayCivil = civilDateInTimeZone(new Date(), OWNER_TIME_ZONE);
  const today = formatCivilDate(todayCivil);
  const bookOn = parseOwnerBookOn(queryString(params.bookOn)) ?? today;

  return (
    <section className="flex flex-col gap-4">
      <OwnerBackLink href="/owner/today" locale={locale} />
      <h2 className="font-heading text-3xl lg:text-4xl">{ui("owner.bookHeading", locale)}</h2>
      <DayChips
        today={todayCivil}
        selectedDate={bookOn}
        pathname="/owner/book"
        dateQueryKey="bookOn"
        locale={locale}
      />
      <Suspense key={bookOn} fallback={<BookSlotsSkeleton />}>
        <OwnerBookSlots bookOn={bookOn} locale={locale} />
      </Suspense>
    </section>
  );
}
