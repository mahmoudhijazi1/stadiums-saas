import type { CurrentMembership } from "@/modules/access/application/get-current-membership";
import { EXPENSES_RECORD, REPORTS_VIEW, can } from "@/modules/access/domain/can";
import { listRecentExpenses } from "@/modules/expense/application/list-recent-expenses";
import {
  EXPENSE_CATEGORIES,
  type ExpenseCategory,
} from "@/modules/expense/domain/categories";
import { summarizeLedgerPeriod } from "@/modules/ledger/application/summarize-ledger-period";
import type { CivilRange, PeriodKind } from "@/modules/ledger/domain/period";
import type { LedgerPeriodQuery } from "@/modules/ledger/schemas/period-query";
import { getCurrentRate } from "@/modules/payment/application/get-current-rate";
import { formatUsdMoney, parseLbp } from "@/lib/money";
import type { UiLocale } from "@/lib/locale";
import { ui } from "@/lib/ui-copy";
import { OWNER_TIME_ZONE } from "@/app/owner/shared";
import { RecordExpenseSheet } from "./expense-sheet";
import { MoneyHeadline } from "./headline";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { LtrIsolate } from "@/components/ui/ltr-isolate";

function formatLocalDay(value: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: OWNER_TIME_ZONE,
    dateStyle: "medium",
  }).format(value);
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
  locale = "ar",
}: {
  membership: CurrentMembership;
  periodQuery: LedgerPeriodQuery;
  kind: PeriodKind;
  range: CivilRange;
  today: string;
  locale?: UiLocale;
}) {
  const expenses = await listRecentExpenses();
  const rate = await getCurrentRate();
  const mayRecordExpense = can(membership, EXPENSES_RECORD);
  const mayViewReports = can(membership, REPORTS_VIEW);
  const summary = mayViewReports
    ? await summarizeLedgerPeriod({ from: range.from, to: range.to, compare: true })
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

      <section className="flex flex-col gap-4">
        <h3 className="type-section">{ui("owner.expenses", locale)}</h3>
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
        {expenses.length === 0 ? (
          <EmptyState
            title={ui("empty.expenses", locale)}
            next={
              mayRecordExpense
                ? ui("empty.expensesNextRecord", locale)
                : ui("empty.expensesNextStaff", locale)
            }
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {expenses.map((row) => (
              <li key={row.id}>
                <Card className="gap-0 py-0">
                  <div className="flex items-start gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <p className="min-w-0 type-body">
                          <bdi>{row.description}</bdi>
                        </p>
                        <p className="shrink-0 type-strong">
                          <LtrIsolate>{formatUsdMoney(row.amountUsd)}</LtrIsolate>
                        </p>
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 type-caption">
                        <span>{categoryLabel(row.category, locale)}</span>
                        <LtrIsolate>{formatLocalDay(row.occurredAt)}</LtrIsolate>
                      </div>
                    </div>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
