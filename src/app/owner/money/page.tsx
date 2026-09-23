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
import { OwnerMoney } from "./panel";
import { MoneySkeleton } from "./skeleton";
import {
  OWNER_TIME_ZONE,
  queryString,
  requireOwnerMembership,
} from "@/app/owner/shared";
import { getUiLocale } from "@/lib/get-ui-locale";
import { ui } from "@/lib/ui-copy";

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
  const params = await searchParams;
  const membership = await requireOwnerMembership();
  const locale = await getUiLocale();
  const periodQuery = readPeriodQuery(params);
  const today = formatCivilDate(
    civilDateInTimeZone(new Date(), OWNER_TIME_ZONE),
  );

  return (
    <section className="flex flex-col gap-4">
      <h2 className="font-heading text-3xl lg:text-4xl">{ui("owner.reports", locale)}</h2>
      <Suspense fallback={<MoneySkeleton />}>
        <OwnerMoney
          membership={membership}
          periodQuery={periodQuery}
          today={today}
          locale={locale}
        />
      </Suspense>
    </section>
  );
}
