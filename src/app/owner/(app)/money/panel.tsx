import type { CurrentMembership } from "@/modules/access/application/get-current-membership";
import { EXPENSES_RECORD, REPORTS_VIEW, SHOP_SELL, can } from "@/modules/access/domain/can";
import {
  EXPENSE_CATEGORIES,
  type ExpenseCategory,
} from "@/modules/expense/domain/categories";
import { sumExpenseCategory } from "@/modules/expense/application/sum-expense-category";
import { summarizeShopPeriod } from "@/modules/shop/application/summarize-shop-period";
import { summarizeLedgerPeriod } from "@/modules/ledger/application/summarize-ledger-period";
import type { CivilRange, PeriodKind } from "@/modules/ledger/domain/period";
import type { LedgerPeriodQuery } from "@/modules/ledger/schemas/period-query";
import { getCurrentRate } from "@/modules/payment/application/get-current-rate";
import Link from "next/link";
import { CircleAlert, ChevronRight } from "lucide-react";
import { LtrIsolate } from "@/components/ui/ltr-isolate";
import { formatUsdCompact } from "@/lib/format/money";
import { parseLbp } from "@/lib/format/parse-money";
import { listOwed } from "@/modules/booking/application/list-owed";
import type { UiLocale } from "@/lib/locale";
import { ui, uiCount } from "@/lib/ui-copy";
import { RecordExpenseSheet } from "./expense-sheet";
import { Button } from "@/components/ui/button";
import { activityHref } from "./query";
import { CashToday, type CashTodayView } from "./cash-today";
import { PeriodBar } from "./period-bar";
import { SummaryCard } from "./summary-card";
import { ActivityList } from "./activity";
import { ShopRow, showsShopRow } from "./shop-row";
import { loadActivityPage } from "./activity-load";
import { summarizeCash } from "@/modules/payment/application/summarize-cash";
import { cashLineCurrencies, type CashDay } from "@/modules/payment/domain/cash-day";
import { businessDate, businessDayUtcRange } from "@/modules/booking/domain/business-day";
import { getCurrentTenant } from "@/lib/tenant-context";
import { formatCivilDate } from "@/modules/venue/domain/availability";

function cashView(day: CashDay): CashTodayView {
  const text = (value: CashDay["net"]) => ({
    USD: value.USD.toFixed(2),
    LBP: value.LBP.toFixed(0),
  });
  return { net: text(day.net), in: text(day.in), out: text(day.out), shown: cashLineCurrencies(day) };
}

function categoryLabel(category: ExpenseCategory, locale: UiLocale): string {
  return ui(`cat.${category}`, locale);
}

export async function OwnerMoney({
  membership,
  periodQuery,
  kind,
  range,
  today,
  highlightNew = false,
  locale = "ar",
}: {
  membership: CurrentMembership;
  periodQuery: LedgerPeriodQuery;
  kind: PeriodKind;
  range: CivilRange;
  today: string;
  /** Just saved an expense: highlight the newest Activity row. */
  highlightNew?: boolean;
  locale?: UiLocale;
}) {
  const rate = await getCurrentRate();
  const mayRecordExpense = can(membership, EXPENSES_RECORD);
  const mayViewReports = can(membership, REPORTS_VIEW);
  const maySell = can(membership, SHOP_SELL);
  const summary = mayViewReports
    ? await summarizeLedgerPeriod({ from: range.from, to: range.to, compare: true })
    : null;
  const activity = mayViewReports
    ? await loadActivityPage({ ...range, filter: "all", limit: 5 }, locale)
    : null;
  const owed = mayViewReports ? await listOwed() : null;
  // Cash today: only when the period contains today (the calendar day or the current business day,
  // which differ between midnight and the day start). One more read, reports.view only.
  const tenant = await getCurrentTenant();
  const businessToday = businessDate(new Date(), tenant.dayStartHour);
  const periodHasToday = [today, formatCivilDate(businessToday)].some((day) => day >= range.from && day <= range.to);
  const cash =
    mayViewReports && periodHasToday
      ? await summarizeCash(businessDayUtcRange(businessToday, tenant.dayStartHour))
      : null;
  const [shop, supplies] = mayViewReports
    ? await Promise.all([
        summarizeShopPeriod(range),
        sumExpenseCategory({ ...range, category: "SHOP_SUPPLIES" }),
      ])
    : [null, null];
  const typedDisplayRate = periodQuery.displayRate ? parseLbp(periodQuery.displayRate) : null;
  const displayRate = typedDisplayRate ?? rate;

  return (
    <div className="flex flex-col gap-8">
      {summary ? (
        <div className="flex flex-col gap-4">
          <PeriodBar
            kind={kind}
            from={summary.from}
            to={summary.to}
            view={periodQuery.view}
            rateKnown={displayRate !== null}
            locale={locale}
          />
          <SummaryCard
            summary={summary}
            kind={kind}
            view={periodQuery.view}
            lbpPerUsd={displayRate}
            locale={locale}
          />
        </div>
      ) : null}

      {owed && owed.games > 0 ? (
        <Link
          href="/owner/money/owed"
          className="flex min-h-14 items-center gap-3 rounded-xl border border-owed/60 bg-owed-subtle px-4 py-3 text-owed outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <CircleAlert aria-hidden className="size-5 shrink-0" />
          <span className="type-strong min-w-0 flex-1">
            {ui("owner.owedToYou", locale)} <LtrIsolate>{`$${formatUsdCompact(owed.totalUsd)}`}</LtrIsolate>
            <span aria-hidden> · </span>
            {uiCount("owner.games", owed.games, locale)}
          </span>
          <ChevronRight aria-hidden className="size-4 shrink-0 rtl:rotate-180" />
        </Link>
      ) : null}

      {cash ? <CashToday view={cashView(cash)} locale={locale} /> : null}

      {mayRecordExpense || maySell ? (
        <div className="flex gap-2">
          {mayRecordExpense ? (
            <RecordExpenseSheet
              periodQuery={periodQuery}
              today={today}
              locale={locale}
              lbpPerUsd={rate ? rate.toString() : null}
              membershipId={membership.membershipId}
              categoryOptions={EXPENSE_CATEGORIES.map((category) => ({
                value: category,
                label: categoryLabel(category, locale),
              }))}
            />
          ) : null}
          {maySell ? (
            <Button asChild variant="secondary" className="min-h-11 flex-1">
              <Link href="/owner/sell">{ui("owner.sell", locale)}</Link>
            </Button>
          ) : null}
        </div>
      ) : null}

      {activity ? (
        <ActivityList
          key={`recent-${range.from}-${range.to}`}
          variant="recent"
          allHref={activityHref({
            period: kind,
            from: kind === "custom" ? range.from : undefined,
            to: kind === "custom" ? range.to : undefined,
            view: periodQuery.view,
          })}
          initialRows={activity.rows}
          initialCursor={null}
          filter="all"
          range={range}
          periodKey={{
            period: kind,
            from: kind === "custom" ? range.from : undefined,
            to: kind === "custom" ? range.to : undefined,
            view: periodQuery.view,
          }}
          now={new Date().toISOString()}
          highlightFirst={highlightNew}
          locale={locale}
        />
      ) : null}

      {shop && supplies && showsShopRow(shop.items.length, supplies) ? (
        <ShopRow salesUsd={shop.salesUsd} kind={kind} range={range} view={periodQuery.view} locale={locale} />
      ) : null}
    </div>
  );
}
