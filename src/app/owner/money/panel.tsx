import Decimal from "decimal.js";
import type { CurrentMembership } from "@/modules/access/application/get-current-membership";
import { EXPENSES_RECORD, REPORTS_VIEW, can } from "@/modules/access/domain/can";
import { listRecentExpenses } from "@/modules/expense/application/list-recent-expenses";
import {
  EXPENSE_CATEGORIES,
  type ExpenseCategory,
} from "@/modules/expense/domain/categories";
import { summarizeLedgerPeriod } from "@/modules/ledger/application/summarize-ledger-period";
import { usdToDisplayLbp } from "@/modules/ledger/domain/totals";
import type { LedgerPeriodQuery } from "@/modules/ledger/schemas/period-query";
import { getCurrentRate } from "@/modules/payment/application/get-current-rate";
import { formatUsd, parseLbp } from "@/lib/money";
import type { UiLocale } from "@/lib/locale";
import { ui } from "@/lib/ui-copy";
import { OWNER_TIME_ZONE } from "@/app/owner/shared";
import { inOutBarPercents } from "./bars";
import { Reveal } from "./reveal";
import { RecordExpenseSheet } from "./expense-sheet";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import { DateField } from "@/components/ui/date-field";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { LtrIsolate } from "@/components/ui/ltr-isolate";
import { Label } from "@/components/ui/label";
import { SelectField } from "@/components/ui/select-field";
import {
  Banknote,
  Drill,
  Droplets,
  Ellipsis,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react";

const CATEGORY_ICONS: Record<ExpenseCategory, LucideIcon> = {
  ELECTRICITY: Zap,
  WATER: Droplets,
  MAINTENANCE: Wrench,
  SALARY: Banknote,
  EQUIPMENT: Drill,
  OTHER: Ellipsis,
};

function keepPeriodQuery(
  tenantSlug: string,
  period: LedgerPeriodQuery,
) {
  return (
    <>
      <input type="hidden" name="tenant" value={tenantSlug} />
      {period.from ? (
        <input type="hidden" name="from" value={period.from} />
      ) : null}
      {period.to ? <input type="hidden" name="to" value={period.to} /> : null}
      {period.view !== "usd" ? (
        <input type="hidden" name="view" value={period.view} />
      ) : null}
      {period.displayRate ? (
        <input type="hidden" name="displayRate" value={period.displayRate} />
      ) : null}
    </>
  );
}

function formatLocalDay(value: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: OWNER_TIME_ZONE,
    dateStyle: "medium",
  }).format(value);
}

function categoryLabel(category: ExpenseCategory, locale: UiLocale): string {
  return ui(`cat.${category}`, locale);
}

function formatPeriodAmount(
  amountUsd: Decimal,
  showLbp: boolean,
  lbpPerUsd: Decimal | null,
): string {
  if (showLbp && lbpPerUsd) {
    return `${usdToDisplayLbp(amountUsd, lbpPerUsd).toFixed(0)} LBP`;
  }
  return `$${formatUsd(amountUsd)}`;
}

export async function OwnerMoney({
  membership,
  tenantSlug,
  periodQuery,
  today,
  locale = "ar",
}: {
  membership: CurrentMembership;
  tenantSlug: string;
  periodQuery: LedgerPeriodQuery;
  today: string;
  locale?: UiLocale;
}) {
  const expenses = await listRecentExpenses();
  const rate = await getCurrentRate();
  const mayRecordExpense = can(membership, EXPENSES_RECORD);
  const mayViewReports = can(membership, REPORTS_VIEW);
  const summary = mayViewReports
    ? await summarizeLedgerPeriod({
        from: periodQuery.from,
        to: periodQuery.to,
      })
    : null;
  const typedDisplayRate = periodQuery.displayRate
    ? parseLbp(periodQuery.displayRate)
    : null;
  const displayRate = typedDisplayRate ?? rate;
  const showLbp = periodQuery.view === "lbp" && displayRate !== null;
  const lbpNote =
    periodQuery.view === "lbp" && displayRate === null
      ? ui("lbpNote", locale)
      : null;

  return (
    <div className="flex flex-col gap-8">
      {summary ? (
        <section className="flex flex-col gap-4">
          <h3 className="text-sm font-medium text-muted-foreground">
            {ui("owner.period", locale)}
          </h3>
          <Card>
            <CardHeader className="gap-3">
              <CardDescription>
                <LtrIsolate>
                  {summary.from} → {summary.to}
                </LtrIsolate>
              </CardDescription>
              <div>
                <p className="text-xs text-muted-foreground">
                  {ui("owner.difference", locale)}
                </p>
                <p className="mt-0.5 text-2xl font-semibold">
                  <LtrIsolate>
                    {formatPeriodAmount(summary.netUsd, showLbp, displayRate)}
                  </LtrIsolate>
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-primary/15 px-3 py-2">
                  <p className="text-xs text-primary">{ui("owner.in", locale)}</p>
                  <p className="mt-0.5 text-base font-semibold text-primary">
                    <LtrIsolate>
                      {formatPeriodAmount(summary.inUsd, showLbp, displayRate)}
                    </LtrIsolate>
                  </p>
                </div>
                <div className="rounded-lg bg-muted px-3 py-2">
                  <p className="text-xs text-muted-foreground">
                    {ui("owner.out", locale)}
                  </p>
                  <p className="mt-0.5 text-base font-semibold text-foreground">
                    <LtrIsolate>
                      {formatPeriodAmount(
                        summary.outUsd,
                        showLbp,
                        displayRate,
                      )}
                    </LtrIsolate>
                  </p>
                </div>
              </div>
              <InOutBars inUsd={summary.inUsd} outUsd={summary.outUsd} />
              {lbpNote ? (
                <p className="text-sm text-muted-foreground">{lbpNote}</p>
              ) : null}
            </CardHeader>
            <CardContent>
              <Reveal
                closedLabel={ui("owner.changePeriod", locale)}
                openLabel={ui("owner.hidePeriod", locale)}
              >
                <form
                  method="get"
                  action="/owner/money"
                  className="flex flex-col gap-4"
                >
                  <input type="hidden" name="tenant" value={tenantSlug} />
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="from">{ui("owner.from", locale)}</Label>
                    <DateField
                      id="from"
                      name="from"
                      required
                      defaultValue={summary.from}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="to">{ui("owner.to", locale)}</Label>
                    <DateField
                      id="to"
                      name="to"
                      required
                      defaultValue={summary.to}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="view">{ui("owner.view", locale)}</Label>
                    <SelectField
                      id="view"
                      name="view"
                      defaultValue={periodQuery.view}
                      options={[
                        { value: "usd", label: ui("owner.usd", locale) },
                        { value: "lbp", label: ui("owner.lbp", locale) },
                      ]}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="displayRate">
                      {ui("owner.displayRate", locale)}
                    </Label>
                    <Input
                      id="displayRate"
                      type="text"
                      name="displayRate"
                      inputMode="numeric"
                      placeholder="90000"
                      defaultValue={periodQuery.displayRate ?? ""}
                      className="font-mono"
                    />
                  </div>
                  <Button type="submit" variant="secondary" className="w-full">
                    {ui("owner.show", locale)}
                  </Button>
                </form>
              </Reveal>
            </CardContent>
          </Card>
        </section>
      ) : null}

      <section className="flex flex-col gap-4">
        <h3 className="text-sm font-medium text-muted-foreground">
          {ui("owner.expenses", locale)}
        </h3>
        {mayRecordExpense ? (
          <RecordExpenseSheet
            tenantSlug={tenantSlug}
            periodQuery={periodQuery}
            today={today}
            locale={locale}
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
            {expenses.map((row) => {
              const Icon = CATEGORY_ICONS[row.category];
              return (
                <li key={row.id}>
                  <Card className="gap-0 py-0">
                    <div className="flex items-start gap-3 px-4 py-3">
                      <Icon
                        aria-hidden
                        className="mt-0.5 size-5 shrink-0 text-muted-foreground"
                        strokeWidth={1.75}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{row.description}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {categoryLabel(row.category, locale)}
                          {" · "}
                          <LtrIsolate>{formatLocalDay(row.occurredAt)}</LtrIsolate>
                        </p>
                      </div>
                      <p className="shrink-0 font-mono text-sm font-medium">
                        <LtrIsolate>${formatUsd(row.amountUsd)}</LtrIsolate>
                      </p>
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function InOutBars({
  inUsd,
  outUsd,
}: {
  inUsd: Decimal;
  outUsd: Decimal;
}) {
  const { inPct, outPct } = inOutBarPercents(inUsd, outUsd);
  return (
    <div className="flex flex-col gap-2" aria-hidden>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-2 rounded-full bg-primary"
          style={{ width: `${inPct}%` }}
        />
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-2 rounded-full bg-muted-foreground/40"
          style={{ width: `${outPct}%` }}
        />
      </div>
    </div>
  );
}
