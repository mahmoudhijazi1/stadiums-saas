import { Suspense } from "react";
import { getCurrentTenant } from "@/lib/tenant-context";
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
  tenantSlugFrom,
} from "@/app/owner/shared";
import { DayChips } from "@/components/day-chips";
import { EmptyState } from "@/components/ui/empty-state";
import { ui } from "@/lib/ui-copy";

export default async function OwnerBookPage({
  searchParams,
}: PageProps<"/owner/book">) {
  const tenant = await getCurrentTenant();
  const params = await searchParams;
  const tenantSlug = tenantSlugFrom(params, tenant.slug);
  const membership = await requireOwnerMembership(tenantSlug);

  if (!can(membership, BOOKINGS_CREATE)) {
    return (
      <EmptyState
        title={ui("empty.noCreate")}
        next={ui("empty.noCreateNext")}
      />
    );
  }

  const todayCivil = civilDateInTimeZone(new Date(), OWNER_TIME_ZONE);
  const today = formatCivilDate(todayCivil);
  const bookOn = parseOwnerBookOn(queryString(params.bookOn)) ?? today;

  return (
    <section className="flex flex-col gap-4">
      <h2 className="font-heading text-xl">{ui("owner.bookHeading")}</h2>
      <DayChips
        tenantSlug={tenantSlug}
        today={todayCivil}
        selectedDate={bookOn}
        pathname="/owner/book"
        dateQueryKey="bookOn"
      />
      <Suspense key={bookOn} fallback={<BookSlotsSkeleton />}>
        <OwnerBookSlots tenantSlug={tenantSlug} bookOn={bookOn} />
      </Suspense>
    </section>
  );
}
