import { Suspense } from "react";
import { ZodError } from "zod";
import { getCurrentTenant } from "@/lib/tenant-context";
import {
  parseLedgerPeriodQuery,
  type LedgerPeriodQuery,
} from "@/modules/ledger/schemas/period-query";
import {
  civilDateInTimeZone,
  formatCivilDate,
} from "@/modules/venue/domain/availability";
import { OwnerMoney } from "./panel";
import { MoneySkeleton } from "./skeleton";
import {
  OWNER_TIME_ZONE,
  queryString,
  requireOwnerMembership,
  tenantSlugFrom,
} from "@/app/owner/shared";

function readPeriodQuery(params: {
  from?: string | string[];
  to?: string | string[];
  view?: string | string[];
  displayRate?: string | string[];
}): LedgerPeriodQuery {
  try {
    return parseLedgerPeriodQuery({
      from: queryString(params.from),
      to: queryString(params.to),
      view: queryString(params.view),
      displayRate: queryString(params.displayRate),
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return {
        from: undefined,
        to: undefined,
        view: "usd",
        displayRate: undefined,
      };
    }
    throw error;
  }
}

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
