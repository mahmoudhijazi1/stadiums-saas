import { Suspense } from "react";
import {
  civilDateInTimeZone,
  formatCivilDate,
} from "@/modules/venue/domain/availability";
import { OwnerMoney } from "./panel";
import { readPeriodQuery, resolvePeriod } from "./period-url";
import { MoneySkeleton } from "./skeleton";
import {
  OWNER_TIME_ZONE,
  queryString,
  requireOwnerMembership,
} from "@/app/owner/shared";
import { getUiLocale } from "@/lib/get-ui-locale";

export default async function OwnerMoneyPage({
  searchParams,
}: PageProps<"/owner/money">) {
  const params = await searchParams;
  const membership = await requireOwnerMembership();
  const locale = await getUiLocale();
  const periodQuery = readPeriodQuery(params);
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
