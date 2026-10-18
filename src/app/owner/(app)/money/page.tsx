import { Suspense } from "react";
import {
  civilDateInTimeZone,
  formatCivilDate,
} from "@/modules/venue/domain/availability";
import { OwnerMoney } from "@/app/owner/(app)/money/_components/panel";
import { readPeriodQuery, resolvePeriod, withDefaultView } from "@/app/owner/(app)/money/_components/period-url";
import { MoneySkeleton } from "@/app/owner/(app)/money/_components/skeleton";
import { OWNER_TIME_ZONE } from "@/lib/format/time";
import { queryString } from "@/lib/search-params";
import { requireOwnerMembership } from "@/app/owner/require-owner";
import { getUiLocale } from "@/lib/get-ui-locale";
import { getCurrentTenant } from "@/lib/tenant-context";

export default async function OwnerMoneyPage({
  searchParams,
}: PageProps<"/owner/money">) {
  const params = await searchParams;
  const membership = await requireOwnerMembership();
  const locale = await getUiLocale();
  const periodQuery = withDefaultView(readPeriodQuery(params), (await getCurrentTenant()).gamePriceCurrency);
  const now = new Date();
  const today = formatCivilDate(civilDateInTimeZone(now, OWNER_TIME_ZONE));
  const { kind, range } = resolvePeriod(periodQuery, now);

  return (
    <section className="flex flex-col gap-4">
      <Suspense fallback={<MoneySkeleton />}>
        <OwnerMoney
          membership={membership}
          periodQuery={periodQuery}
          kind={kind}
          range={range}
          today={today}
          highlightNew={queryString(params.new) === "1"}
          locale={locale}
        />
      </Suspense>
    </section>
  );
}
