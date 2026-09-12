import Decimal from "decimal.js";
import type { CurrentMembership } from "@/modules/access/application/get-current-membership";
import { EXPENSES_RECORD, REPORTS_VIEW, can } from "@/modules/access/domain/can";
import { listOpenWaitlist } from "@/modules/booking/application/list-open-waitlist";
import { listRecentExpenses } from "@/modules/expense/application/list-recent-expenses";
import { EXPENSE_CATEGORIES } from "@/modules/expense/domain/categories";
import { summarizeLedgerPeriod } from "@/modules/ledger/application/summarize-ledger-period";
import { usdToDisplayLbp } from "@/modules/ledger/domain/totals";
import type { LedgerPeriodQuery } from "@/modules/ledger/schemas/period-query";
import { getCurrentRate } from "@/modules/payment/application/get-current-rate";
import { formatUsd, parseLbp } from "@/lib/money";
import {
  lbpPerUsdLine,
  ui,
} from "@/lib/ui-copy";
import { submitRecordExpense, submitSetExchangeRate } from "@/app/owner/actions";
import {
  categoryLabel,
  formatLocalDay,
  formatLocalRange,
  keepOwnerQuery,
} from "@/app/owner/shared";
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
import { Label } from "@/components/ui/label";
import { SelectField } from "@/components/ui/select-field";
import { SubmitButton } from "@/components/ui/submit-button";

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

export async function OwnerRest({
  membership,
  tenantSlug,
  bookOn,
  periodQuery,
  today,
}: {
  membership: CurrentMembership;
  tenantSlug: string;
  bookOn: string;
  periodQuery: LedgerPeriodQuery;
  today: string;
}) {
  const waitlist = await listOpenWaitlist();
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
    <>
      <section className="flex flex-col gap-4">
        <h2 className="font-heading text-lg">{ui("owner.waitlist")}</h2>
        {waitlist.length === 0 ? (
          <EmptyState
            title={ui("empty.waitlist")}
            next={ui("empty.waitlistNext")}
          />
        ) : (
          <ul className="flex flex-col gap-3">
            {waitlist.map((group) => (
              <li key={`${group.pitchId}-${group.start.toISOString()}`}>
                <Card>
                  <CardHeader className="gap-1">
                    <CardTitle className="text-base">{group.pitchName}</CardTitle>
                    <CardDescription className="font-mono">
                      {formatLocalRange(group.start, group.end)}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul className="flex flex-col gap-3">
                      {group.people.map((person) => (
                        <li
                          key={person.personId}
                          className="flex items-center justify-between gap-3"
                        >
                          <div className="min-w-0">
                            <p>{person.name}</p>
                            <p className="font-mono text-sm text-muted-foreground">
                              {person.phone}
                            </p>
                          </div>
                          {person.whatsAppHref ? (
                            <Button variant="outline" asChild>
                              <a
                                href={person.whatsAppHref}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                {ui("owner.notify")}
                              </a>
                            </Button>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      {summary ? (
        <section className="flex flex-col gap-4">
          <h2 className="font-heading text-lg">{ui("owner.period")}</h2>
          <Card>
            <CardHeader className="gap-1">
              <CardDescription className="font-mono">
                {summary.from} → {summary.to}
              </CardDescription>
              <p className="font-mono text-base font-medium">
                {ui("owner.difference")}{" "}
                {formatPeriodAmount(summary.netUsd, showLbp, displayRate)}
              </p>
              <p className="font-mono text-sm text-muted-foreground">
                {ui("owner.in")} {formatPeriodAmount(summary.inUsd, showLbp, displayRate)}
              </p>
              <p className="font-mono text-sm text-muted-foreground">
                {ui("owner.out")} {formatPeriodAmount(summary.outUsd, showLbp, displayRate)}
              </p>
              {lbpNote ? (
                <p className="text-sm text-muted-foreground">{lbpNote}</p>
              ) : null}
            </CardHeader>
            <CardContent>
              <form method="get" action="/owner" className="flex flex-col gap-4">
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
        <h2 className="font-heading text-lg">{ui("owner.rate")}</h2>
        <Card>
          <CardHeader>
            <CardDescription className="font-mono">
              {rate ? lbpPerUsdLine(rate.toFixed(0)) : ui("owner.noRate")}
            </CardDescription>
          </CardHeader>
          {isOwner ? (
            <CardContent>
              <form action={submitSetExchangeRate} className="flex flex-col gap-4">
                {keepOwnerQuery(tenantSlug, bookOn, periodQuery)}
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
        <h2 className="font-heading text-lg">{ui("owner.expenses")}</h2>
        {mayRecordExpense ? (
          <Card>
            <CardHeader className="gap-1">
              <CardTitle className="text-base">{ui("owner.recordExpense")}</CardTitle>
            </CardHeader>
            <CardContent>
              <form action={submitRecordExpense} className="flex flex-col gap-4">
                {keepOwnerQuery(tenantSlug, bookOn, periodQuery)}
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
                <span className="font-mono">{formatLocalDay(row.occurredAt)}</span>{" "}
                — <span className="font-mono">${formatUsd(row.amountUsd)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
