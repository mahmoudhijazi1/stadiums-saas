import { Suspense } from "react";
import { getCurrentTenant } from "@/lib/tenant-context";
import {
  civilDateInTimeZone,
  formatCivilDate,
} from "@/modules/venue/domain/availability";
import { OwnerMoney } from "./panel";
import {
  OWNER_TIME_ZONE,
  readPeriodQuery,
  requireOwnerMembership,
  tenantSlugFrom,
} from "@/app/owner/shared";
import { MoneySkeleton } from "@/app/owner/skeletons";

export default async function OwnerMoneyPage({
  searchParams,
}: PageProps<"/owner/money">) {
  const tenant = await getCurrentTenant();
  const params = await searchParams;
  const tenantSlug = tenantSlugFrom(params, tenant.slug);
  const membership = await requireOwnerMembership(tenantSlug);
  const periodQuery = readPeriodQuery(params);
  const today = formatCivilDate(
    civilDateInTimeZone(new Date(), OWNER_TIME_ZONE),
  );

  return (
    <Suspense fallback={<MoneySkeleton />}>
      <OwnerMoney
        membership={membership}
        tenantSlug={tenantSlug}
        periodQuery={periodQuery}
        today={today}
      />
    </Suspense>
  );
}
