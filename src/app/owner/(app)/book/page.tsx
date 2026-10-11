import { Suspense } from "react";
import { getCurrentTenant } from "@/lib/tenant-context";
import { businessDate } from "@/modules/booking/domain/business-day";
import { formatCivilDate } from "@/modules/venue/domain/availability";
import { BOOKINGS_CREATE, can } from "@/modules/access/domain/can";
import { OwnerBookSlots } from "@/app/owner/(app)/book/_components/slots";
import { parseOwnerBookOn } from "@/app/owner/(app)/book/_components/date";
import { BookSlotsSkeleton } from "@/app/owner/(app)/book/_components/skeleton";
import { OWNER_TIME_ZONE } from "@/lib/format/time";
import { queryString } from "@/lib/search-params";
import { requireOwnerMembership } from "@/app/owner/require-owner";
import { OwnerBackLink } from "@/components/shell/back-link";
import { DayChips } from "@/modules/venue/ui/day-chips";
import { EmptyState } from "@/components/ui/empty-state";
import { getUiLocale } from "@/lib/get-ui-locale";
import { ui } from "@/lib/copy";

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

  // Business date, like Today and the public page: before the tenant's day start it is last night.
  const todayCivil = businessDate(new Date(), (await getCurrentTenant()).dayStartHour, OWNER_TIME_ZONE);
  const today = formatCivilDate(todayCivil);
  const bookOn = parseOwnerBookOn(queryString(params.bookOn)) ?? today;

  return (
    <section className="flex flex-col gap-4">
      <OwnerBackLink href="/owner/today" locale={locale} history />
      <h2 className="font-heading text-3xl lg:text-4xl">{ui("owner.bookHeading", locale)}</h2>
      <DayChips
        today={todayCivil}
        selectedDate={bookOn}
        pathname="/owner/book"
        dateQueryKey="bookOn"
        locale={locale}
      />
      <Suspense key={bookOn} fallback={<BookSlotsSkeleton />}>
        <OwnerBookSlots bookOn={bookOn} today={todayCivil} locale={locale} />
      </Suspense>
    </section>
  );
}
