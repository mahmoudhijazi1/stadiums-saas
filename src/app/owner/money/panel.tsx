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
import { ui } from "@/lib/ui-copy";
import { OWNER_TIME_ZONE } from "@/app/owner/shared";
import { submitRecordExpense, submitSetExchangeRate } from "./actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DateField } from "@/components/ui/date-field";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { LtrIsolate } from "@/components/ui/ltr-isolate";
import { Label } from "@/components/ui/label";
import { SelectField } from "@/components/ui/select-field";
import { SubmitButton } from "@/components/ui/submit-button";

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

function categoryLabel(category: ExpenseCategory): string {
  return ui(`cat.${category}`);
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
}: {
  membership: CurrentMembership;
  tenantSlug: string;
  periodQuery: LedgerPeriodQuery;
  today: string;
}) {
  const expenses = await listRecentExpenses();
  const rate = await getCurrentRate();
  const mayRecordExpense = can(membership, EXPENSES_RECORD);
  const mayViewReports = can(membership, REPORTS_VIEW);
  const isOwner = membership.role === "OWNER";
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
      ? ui("lbpNote")
      : null;

  return (
    <div className="flex flex-col gap-8">
      {summary ? (
        <section className="flex flex-col gap-4">
          <h3 className="text-sm font-medium text-muted-foreground">
            {ui("owner.period")}
          </h3>
          <Card>
            <CardHeader className="gap-1">
              <CardDescription>
                <LtrIsolate>
                  {summary.from} → {summary.to}
                </LtrIsolate>
              </CardDescription>
              <p className="text-base font-medium">
                {ui("owner.difference")}{" "}
                <LtrIsolate>
                  {formatPeriodAmount(summary.netUsd, showLbp, displayRate)}
                </LtrIsolate>
              </p>
              <p className="text-sm text-muted-foreground">
                {ui("owner.in")}{" "}
                <LtrIsolate>
                  {formatPeriodAmount(summary.inUsd, showLbp, displayRate)}
                </LtrIsolate>
              </p>
              <p className="text-sm text-muted-foreground">
                {ui("owner.out")}{" "}
                <LtrIsolate>
                  {formatPeriodAmount(summary.outUsd, showLbp, displayRate)}
                </LtrIsolate>
              </p>
              {lbpNote ? (
                <p className="text-sm text-muted-foreground">{lbpNote}</p>
              ) : null}
            </CardHeader>
            <CardContent>
              <form
                method="get"
                action="/owner/money"
                className="flex flex-col gap-4"
              >
                <input type="hidden" name="tenant" value={tenantSlug} />
                <div className="flex flex-col gap-2">
                  <Label htmlFor="from">{ui("owner.from")}</Label>
                  <DateField
                    id="from"
                    name="from"
                    required
                    defaultValue={summary.from}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="to">{ui("owner.to")}</Label>
                  <DateField
                    id="to"
                    name="to"
                    required
                    defaultValue={summary.to}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="view">{ui("owner.view")}</Label>
                  <SelectField
                    id="view"
                    name="view"
                    defaultValue={periodQuery.view}
                    options={[
                      { value: "usd", label: ui("owner.usd") },
                      { value: "lbp", label: ui("owner.lbp") },
                    ]}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="displayRate">{ui("owner.displayRate")}</Label>
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
                  {ui("owner.show")}
                </Button>
              </form>
            </CardContent>
          </Card>
        </section>
      ) : null}

      <section className="flex flex-col gap-4">
        <h3 className="text-sm font-medium text-muted-foreground">
          {ui("owner.rate")}
        </h3>
        <Card>
          <CardHeader>
            <CardDescription>
              {rate ? (
                <>
                  <LtrIsolate>{rate.toFixed(0)}</LtrIsolate> ليرة لكل دولار
                </>
              ) : (
                ui("owner.noRate")
              )}
            </CardDescription>
          </CardHeader>
          {isOwner ? (
            <CardContent>
              <form
                action={submitSetExchangeRate}
                className="flex flex-col gap-4"
              >
                {keepPeriodQuery(tenantSlug, periodQuery)}
                <div className="flex flex-col gap-2">
                  <Label htmlFor="lbpPerUsd">{ui("owner.newRate")}</Label>
                  <Input
                    id="lbpPerUsd"
                    type="text"
                    name="lbpPerUsd"
                    required
                    inputMode="numeric"
                    className="font-mono"
                  />
                </div>
                <SubmitButton variant="secondary" className="w-full">
                  {ui("owner.setRate")}
                </SubmitButton>
              </form>
            </CardContent>
          ) : null}
        </Card>
      </section>

      <section className="flex flex-col gap-4">
        <h3 className="text-sm font-medium text-muted-foreground">
          {ui("owner.expenses")}
        </h3>
        {mayRecordExpense ? (
          <Card>
            <CardHeader className="gap-1">
              <CardTitle className="text-base">
                {ui("owner.recordExpense")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form
                action={submitRecordExpense}
                className="flex flex-col gap-4"
              >
                {keepPeriodQuery(tenantSlug, periodQuery)}
                <div className="flex flex-col gap-2">
                  <Label htmlFor="category">{ui("owner.category")}</Label>
                  <SelectField
                    id="category"
                    name="category"
                    required
                    defaultValue="ELECTRICITY"
                    options={EXPENSE_CATEGORIES.map((category) => ({
                      value: category,
                      label: categoryLabel(category),
                    }))}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="description">{ui("owner.what")}</Label>
                  <Input
                    id="description"
                    type="text"
                    name="description"
                    required
                    maxLength={200}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="occurredOn">{ui("owner.when")}</Label>
                  <DateField
                    id="occurredOn"
                    name="occurredOn"
                    required
                    defaultValue={today}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="expenseUsd">{ui("owner.usd")}</Label>
                  <Input
                    id="expenseUsd"
                    type="text"
                    name="usdAmount"
                    inputMode="decimal"
                    placeholder="30.00"
                    className="font-mono"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="expenseLbp">{ui("owner.lbp")}</Label>
                  <Input
                    id="expenseLbp"
                    type="text"
                    name="lbpAmount"
                    inputMode="numeric"
                    className="font-mono"
                  />
                </div>
                <SubmitButton className="w-full">
                  {ui("owner.recordExpenseSubmit")}
                </SubmitButton>
              </form>
            </CardContent>
          </Card>
        ) : null}
        {expenses.length === 0 ? (
          <EmptyState
            title={ui("empty.expenses")}
            next={
              mayRecordExpense
                ? ui("empty.expensesNextRecord")
                : ui("empty.expensesNextStaff")
            }
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {expenses.map((row) => (
              <li key={row.id} className="text-sm">
                {categoryLabel(row.category)} — {row.description} —{" "}
                <LtrIsolate>{formatLocalDay(row.occurredAt)}</LtrIsolate> —{" "}
                <LtrIsolate>${formatUsd(row.amountUsd)}</LtrIsolate>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
