import type { CurrentMembership } from "@/modules/access/application/get-current-membership";
import { EXPENSES_RECORD, REPORTS_VIEW, can } from "@/modules/access/domain/can";
import {
  EXPENSE_CATEGORIES,
  type ExpenseCategory,
} from "@/modules/expense/domain/categories";
import { summarizeLedgerPeriod } from "@/modules/ledger/application/summarize-ledger-period";
import type { CivilRange, PeriodKind } from "@/modules/ledger/domain/period";
import type { LedgerPeriodQuery } from "@/modules/ledger/schemas/period-query";
import { getCurrentRate } from "@/modules/payment/application/get-current-rate";
import { parseLbp } from "@/lib/money";
import type { UiLocale } from "@/lib/locale";
import { ui } from "@/lib/ui-copy";
import { RecordExpenseSheet } from "./expense-sheet";
import { MoneyHeadline } from "./headline";
import { ActivityList } from "./activity";
import { loadActivityPage } from "./activity-load";

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
  const summary = mayViewReports
    ? await summarizeLedgerPeriod({ from: range.from, to: range.to, compare: true })
    : null;
  const activity = mayViewReports
    ? await loadActivityPage({ ...range, filter: periodQuery.filter }, locale)
    : null;
  const typedDisplayRate = periodQuery.displayRate ? parseLbp(periodQuery.displayRate) : null;
  const displayRate = typedDisplayRate ?? rate;

  return (
    <div className="flex flex-col gap-8">
      {summary ? (
        <MoneyHeadline
          summary={summary}
          kind={kind}
          view={periodQuery.view}
          lbpPerUsd={displayRate}
          rateKnown={displayRate !== null}
          locale={locale}
        />
      ) : null}

      {mayRecordExpense ? (
        <RecordExpenseSheet
          periodQuery={periodQuery}
          today={today}
          locale={locale}
          lbpPerUsd={rate ? rate.toString() : null}
          categoryOptions={EXPENSE_CATEGORIES.map((category) => ({
            value: category,
            label: categoryLabel(category, locale),
          }))}
        />
      ) : null}

      {activity ? (
        <ActivityList
          initialRows={activity.rows}
          initialCursor={activity.nextCursor}
          filter={periodQuery.filter}
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
    </div>
  );
}
