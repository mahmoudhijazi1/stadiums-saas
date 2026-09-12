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
import { Button } from "@/components/ui/button";
import { DateField } from "@/components/ui/date-field";
import { EmptyState } from "@/components/ui/empty-state";
import { Label } from "@/components/ui/label";
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

  const today = formatCivilDate(
    civilDateInTimeZone(new Date(), OWNER_TIME_ZONE),
  );
  const bookOn = parseOwnerBookOn(queryString(params.bookOn)) ?? today;

  return (
    <section className="flex flex-col gap-4">
      <h2 className="font-heading text-lg">{ui("owner.bookHeading")}</h2>
      <form method="get" action="/owner/book" className="flex flex-col gap-3">
        <input type="hidden" name="tenant" value={tenantSlug} />
        <div className="flex flex-col gap-2">
          <Label htmlFor="bookOn">{ui("public.day")}</Label>
          <DateField
            id="bookOn"
            name="bookOn"
            required
            defaultValue={bookOn}
          />
        </div>
        <Button type="submit" variant="secondary" className="w-full">
          {ui("owner.showSlots")}
        </Button>
      </form>
      <Suspense key={bookOn} fallback={<BookSlotsSkeleton />}>
        <OwnerBookSlots tenantSlug={tenantSlug} bookOn={bookOn} />
      </Suspense>
    </section>
  );
}
