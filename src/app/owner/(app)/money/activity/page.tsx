import { Suspense } from "react";
import { OwnerBackLink } from "@/app/owner/back-link";
import { requireOwnerMembership } from "@/app/owner/shared";
import { EmptyState } from "@/components/ui/empty-state";
import { getUiLocale } from "@/lib/get-ui-locale";
import { ui } from "@/lib/ui-copy";
import { REPORTS_VIEW, can } from "@/modules/access/domain/can";
import { ActivityList } from "../activity";
import { loadActivityPage } from "../activity-load";
import { periodChipLabel } from "../period-label";
import { readPeriodQuery, resolvePeriod } from "../period-url";
import { moneyHref } from "../query";

/**
 * All activity: every ledger movement in the period, grouped by day, with All / In / Out and
 * "Show more" (keyset). The period and the filter live in the URL, so the links from Money ("In
 * $197") and the chips here keep them. reports.view, checked here for the page and again in each
 * use case.
 */
export default async function MoneyActivityPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const membership = await requireOwnerMembership();
  const locale = await getUiLocale();

  if (!can(membership, REPORTS_VIEW)) {
    return <EmptyState title={ui("empty.noReports", locale)} next={ui("empty.noReportsNext", locale)} />;
  }

  const periodQuery = readPeriodQuery(params);
  const { kind, range } = resolvePeriod(periodQuery, new Date());
  const backQuery = { period: kind, ...(kind === "custom" ? range : {}), view: periodQuery.view };

  return (
    <section className="flex flex-col gap-4">
      <OwnerBackLink href={moneyHref(backQuery)} locale={locale} />
      <h1 className="type-title">
        {ui("owner.activity", locale)} · {periodChipLabel(kind, range, locale)}
      </h1>
      <Suspense fallback={null}>
        <ActivityBody periodQuery={periodQuery} kind={kind} range={range} locale={locale} />
      </Suspense>
    </section>
  );
}

async function ActivityBody({
  periodQuery,
  kind,
  range,
  locale,
}: {
  periodQuery: ReturnType<typeof readPeriodQuery>;
  kind: ReturnType<typeof resolvePeriod>["kind"];
  range: { from: string; to: string };
  locale: Awaited<ReturnType<typeof getUiLocale>>;
}) {
  const page = await loadActivityPage({ ...range, filter: periodQuery.filter }, locale);
  return (
    <ActivityList
      key={`${periodQuery.filter}-${range.from}-${range.to}`}
      initialRows={page.rows}
      initialCursor={page.nextCursor}
      filter={periodQuery.filter}
      range={range}
      periodKey={{
        period: kind,
        from: kind === "custom" ? range.from : undefined,
        to: kind === "custom" ? range.to : undefined,
        view: periodQuery.view,
      }}
      now={new Date().toISOString()}
      highlightFirst={false}
      locale={locale}
    />
  );
}
