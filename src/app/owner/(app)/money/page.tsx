import { Suspense } from "react";
import { ZodError } from "zod";
import {
  parseLedgerPeriodQuery,
  type LedgerPeriodQuery,
} from "@/modules/ledger/schemas/period-query";
import {
  civilDateInTimeZone,
  formatCivilDate,
} from "@/modules/venue/domain/availability";
import { rangeForPeriod, type PeriodKind } from "@/modules/ledger/domain/period";
import { OwnerMoney } from "./panel";
import { MoneySkeleton } from "./skeleton";
import {
  OWNER_TIME_ZONE,
  queryString,
  requireOwnerMembership,
} from "@/app/owner/shared";
import { getUiLocale } from "@/lib/get-ui-locale";

function readPeriodQuery(params: {
  period?: string | string[];
  filter?: string | string[];
  from?: string | string[];
  to?: string | string[];
  view?: string | string[];
  displayRate?: string | string[];
}): LedgerPeriodQuery {
  try {
    return parseLedgerPeriodQuery({
      period: queryString(params.period),
      filter: queryString(params.filter),
      from: queryString(params.from),
      to: queryString(params.to),
      view: queryString(params.view),
      displayRate: queryString(params.displayRate),
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return {
        period: undefined,
        filter: "all",
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
  const params = await searchParams;
  const membership = await requireOwnerMembership();
  const locale = await getUiLocale();
  const periodQuery = readPeriodQuery(params);
  const now = new Date();
  const today = formatCivilDate(civilDateInTimeZone(now, OWNER_TIME_ZONE));
  // A from/to pair is "custom"; otherwise a named period, this month by default.
  const kind: PeriodKind =
    periodQuery.from && periodQuery.to ? "custom" : (periodQuery.period ?? "month");
  const range =
    periodQuery.from && periodQuery.to
      ? { from: periodQuery.from, to: periodQuery.to }
      : rangeForPeriod(kind === "custom" ? "month" : kind, now, OWNER_TIME_ZONE);

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
