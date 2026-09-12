import { redirect } from "next/navigation";
import { ZodError } from "zod";
import Decimal from "decimal.js";
import { errorMessage } from "@/lib/error-messages";
import { getCurrentTenant } from "@/lib/tenant-context";
import { formatUsd, parseLbp } from "@/lib/money";
import { getCurrentMembership } from "@/modules/access/application/get-current-membership";
import {
  BOOKINGS_APPROVE,
  BOOKINGS_CANCEL,
  BOOKINGS_CREATE,
  EXPENSES_RECORD,
  PAYMENTS_COLLECT,
  REPORTS_VIEW,
  can,
} from "@/modules/access/domain/can";
import { listApprovedOccupied } from "@/modules/booking/application/list-approved-occupied";
import { listDueBookings } from "@/modules/booking/application/list-due-bookings";
import { listOpenWaitlist } from "@/modules/booking/application/list-open-waitlist";
import { listPendingRequests } from "@/modules/booking/application/list-pending-requests";
import { listRecentExpenses } from "@/modules/expense/application/list-recent-expenses";
import { EXPENSE_CATEGORIES } from "@/modules/expense/domain/categories";
import { summarizeLedgerPeriod } from "@/modules/ledger/application/summarize-ledger-period";
import { usdToDisplayLbp } from "@/modules/ledger/domain/totals";
import {
  parseLedgerPeriodQuery,
  type LedgerPeriodQuery,
} from "@/modules/ledger/schemas/period-query";
import { getCurrentRate } from "@/modules/payment/application/get-current-rate";
import { getDayAvailability } from "@/modules/venue/application/get-day-availability";
import type { CivilDate } from "@/modules/venue/domain/availability";
import { submitLogout } from "@/app/login/actions";
import {
  submitApproveBooking,
  submitCancelBooking,
  submitCollectPayment,
  submitCreateOwnerBooking,
  submitRecordExpense,
  submitRejectBooking,
  submitSetExchangeRate,
} from "@/app/owner/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const TIME_ZONE = "Asia/Beirut";

const nativeField =
  "h-11 w-full rounded-md border border-input bg-background px-3 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

function queryString(
  value: string | string[] | undefined,
): string | undefined {
  return typeof value === "string" ? value : undefined;
}

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

/**
 * Thin locked page. No Prisma and no tenantId.
 * Next 16: searchParams is a Promise (page.js docs). Period form is GET, not a Server Action.
 * Pending inbox (SPEC-05) + rate + collect (SPEC-06) + expenses (SPEC-07) + ledger summary (SPEC-08) + owner Book (SPEC-09) + cancel (SPEC-10) + waitlist (SPEC-11).
 */
export default async function OwnerPage({ searchParams }: PageProps<"/owner">) {
  const tenant = await getCurrentTenant();
  const params = await searchParams;
  const tenantSlug =
    typeof params.tenant === "string" && params.tenant.length > 0
      ? params.tenant
      : tenant.slug;
  const membership = await getCurrentMembership();

  if (!membership) {
    const next = new URLSearchParams();
    next.set("tenant", tenantSlug);
    redirect(`/login?${next.toString()}`);
  }

  const pending = await listPendingRequests();
  const confirmed = await listDueBookings();
  const waitlist = await listOpenWaitlist();
  const expenses = await listRecentExpenses();
  const rate = await getCurrentRate();
  const mayDecide = can(membership, BOOKINGS_APPROVE);
  const mayCollect = can(membership, PAYMENTS_COLLECT);
  const mayCancel = can(membership, BOOKINGS_CANCEL);
  const mayRecordExpense = can(membership, EXPENSES_RECORD);
  const mayViewReports = can(membership, REPORTS_VIEW);
  const mayCreateBooking = can(membership, BOOKINGS_CREATE);
  const isOwner = membership.role === "OWNER";
  const errorKey = queryString(params.error);
  const today = todayInTimeZone(TIME_ZONE);
  const bookOn = parseOwnerBookOn(queryString(params.bookOn)) ?? today;
  const bookLocalDate = civilFromYyyyMmDd(bookOn);
  const bookPitches = mayCreateBooking
    ? await getDayAvailability({
        localDate: bookLocalDate,
        timeZone: TIME_ZONE,
        occupied: await listApprovedOccupied(),
      })
    : [];
  const periodQuery = readPeriodQuery({
    from: params.from,
    to: params.to,
    view: params.view,
    displayRate: params.displayRate,
  });
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
      ? "Set a display rate (or set exchange rate first)"
      : null;

  return (
    <main className="mx-auto flex w-full max-w-lg flex-col gap-8 px-6 py-8">
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-heading text-2xl">{tenant.name}</h1>
          <p className="text-sm text-muted-foreground">
            <span className="font-mono">{membership.identifier}</span>
            {" · "}
            {membership.role}
          </p>
        </div>
        <form action={submitLogout}>
          <input type="hidden" name="tenant" value={tenantSlug} />
          <Button type="submit" variant="outline">
            Log out
          </Button>
        </form>
      </header>

      {errorKey ? (
        <p className="text-sm text-destructive" role="alert">
          {errorMessage(errorKey)}
        </p>
      ) : null}

      <section className="flex flex-col gap-4">
        <h2 className="font-heading text-xl">Today</h2>

        <h3 className="text-sm font-medium text-muted-foreground">Pending</h3>
        {pending.length === 0 ? (
          <p className="text-sm text-muted-foreground">No pending requests.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {pending.map((row) => (
              <li key={row.id}>
                <Card>
                  <CardHeader className="gap-1">
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle className="text-base">{row.pitchName}</CardTitle>
                      <Badge variant="outline">Pending</Badge>
                    </div>
                    <CardDescription>
                      <span className="font-mono">{formatLocalRange(row.start, row.end)}</span>
                      <span className="mt-1 block">
                        {row.requesterName}{" "}
                        <span className="font-mono">{row.requesterPhone}</span>
                      </span>
                      <span className="mt-1 block">
                        Requested {formatLocalDateTime(row.requestedAt)}
                      </span>
                    </CardDescription>
                  </CardHeader>
                  {mayDecide ? (
                    <CardContent className="flex gap-2">
                      <form action={submitApproveBooking} className="min-w-0 flex-1">
                        <input type="hidden" name="bookingId" value={row.id} />
                        {keepOwnerQuery(tenantSlug, bookOn, periodQuery)}
                        <Button type="submit" className="w-full">
                          Approve
                        </Button>
                      </form>
                      <form action={submitRejectBooking} className="min-w-0 flex-1">
                        <input type="hidden" name="bookingId" value={row.id} />
                        {keepOwnerQuery(tenantSlug, bookOn, periodQuery)}
                        <Button type="submit" variant="outline" className="w-full">
                          Reject
                        </Button>
                      </form>
                    </CardContent>
                  ) : null}
                </Card>
              </li>
            ))}
          </ul>
        )}

        <h3 className="text-sm font-medium text-muted-foreground">Confirmed</h3>
        {confirmed.length === 0 ? (
          <p className="text-sm text-muted-foreground">No confirmed bookings.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {confirmed.map((row) => (
              <li key={row.id}>
                <Card>
                  <CardHeader className="gap-1">
                    <CardTitle className="text-base">{row.pitchName}</CardTitle>
                    <CardDescription>
                      <span className="font-mono">{formatLocalRange(row.start, row.end)}</span>
                      <span className="mt-1 block">
                        {row.requesterName}{" "}
                        <span className="font-mono">{row.requesterPhone}</span>
                      </span>
                      <span className="mt-1 block font-mono">
                        Due ${formatUsd(row.priceUsd)} · remaining $
                        {formatUsd(row.remaining)}
                      </span>
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-4">
                    {mayCollect && row.remaining.gt(0) ? (
                      <>
                        <form action={submitCollectPayment}>
                          <input type="hidden" name="bookingId" value={row.id} />
                          {keepOwnerQuery(tenantSlug, bookOn, periodQuery)}
                          <input
                            type="hidden"
                            name="usdAmount"
                            value={formatUsd(row.remaining)}
                          />
                          <Button type="submit" className="w-full">
                            Collect ${formatUsd(row.remaining)} USD
                          </Button>
                        </form>
                        <form
                          action={submitCollectPayment}
                          className="flex flex-col gap-3"
                        >
                          <input type="hidden" name="bookingId" value={row.id} />
                          {keepOwnerQuery(tenantSlug, bookOn, periodQuery)}
                          <div className="flex flex-col gap-2">
                            <Label htmlFor={`usd-${row.id}`}>USD</Label>
                            <Input
                              id={`usd-${row.id}`}
                              type="text"
                              name="usdAmount"
                              inputMode="decimal"
                              placeholder="30.00"
                              className="font-mono"
                            />
                          </div>
                          <div className="flex flex-col gap-2">
                            <Label htmlFor={`lbp-${row.id}`}>LBP</Label>
                            <Input
                              id={`lbp-${row.id}`}
                              type="text"
                              name="lbpAmount"
                              inputMode="numeric"
                              className="font-mono"
                            />
                          </div>
                          <Button type="submit" variant="secondary" className="w-full">
                            Collect mixed
                          </Button>
                        </form>
                      </>
                    ) : null}
                    {mayCancel ? (
                      <form action={submitCancelBooking}>
                        <input type="hidden" name="bookingId" value={row.id} />
                        {keepOwnerQuery(tenantSlug, bookOn, periodQuery)}
                        <Button type="submit" variant="outline" className="w-full">
                          Cancel
                        </Button>
                      </form>
                    ) : null}
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      {mayCreateBooking ? (
        <section className="flex flex-col gap-4">
          <h2 className="font-heading text-xl">Book a slot</h2>
          <form method="get" action="/owner" className="flex flex-col gap-3">
            <input type="hidden" name="tenant" value={tenantSlug} />
            <div className="flex flex-col gap-2">
              <Label htmlFor="bookOn">Day</Label>
              <Input
                id="bookOn"
                type="date"
                name="bookOn"
                required
                defaultValue={bookOn}
                className="font-mono"
              />
            </div>
            <Button type="submit" variant="secondary" className="w-full">
              Show slots
            </Button>
          </form>
          {bookPitches.length === 0 ? (
            <p className="text-sm text-muted-foreground">No pitches yet.</p>
          ) : (
            <ul className="flex flex-col gap-4">
              {bookPitches.map((pitch) => (
                <li key={pitch.id} className="flex flex-col gap-3">
                  <h3 className="font-medium">{pitch.name}</h3>
                  {pitch.slots.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Closed / No slots.
                    </p>
                  ) : (
                    <ul className="flex flex-col gap-3">
                      {pitch.slots.map((slot) => (
                        <li key={slot.startIso}>
                          <Card>
                            <CardHeader className="gap-1">
                              <CardTitle className="font-mono text-base">
                                {slot.startLocal}–{slot.endLocal}
                              </CardTitle>
                              <CardDescription className="font-mono">
                                ${slot.priceUsd}
                                {slot.available ? null : " · taken"}
                              </CardDescription>
                            </CardHeader>
                            {slot.available ? (
                              <CardContent>
                                <form
                                  action={submitCreateOwnerBooking}
                                  className="flex flex-col gap-3"
                                >
                                  <input
                                    type="hidden"
                                    name="pitchId"
                                    value={pitch.id}
                                  />
                                  <input
                                    type="hidden"
                                    name="start"
                                    value={slot.startIso}
                                  />
                                  <input
                                    type="hidden"
                                    name="end"
                                    value={slot.endIso}
                                  />
                                  {keepOwnerQuery(tenantSlug, bookOn, periodQuery)}
                                  <div className="flex flex-col gap-2">
                                    <Label htmlFor={`name-${slot.startIso}`}>
                                      Name
                                    </Label>
                                    <Input
                                      id={`name-${slot.startIso}`}
                                      type="text"
                                      name="name"
                                      required
                                      autoComplete="name"
                                    />
                                  </div>
                                  <div className="flex flex-col gap-2">
                                    <Label htmlFor={`phone-${slot.startIso}`}>
                                      Phone
                                    </Label>
                                    <Input
                                      id={`phone-${slot.startIso}`}
                                      type="tel"
                                      name="phone"
                                      required
                                      autoComplete="tel"
                                      className="font-mono"
                                    />
                                  </div>
                                  <Button type="submit" className="w-full">
                                    Book
                                  </Button>
                                </form>
                              </CardContent>
                            ) : null}
                          </Card>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      <section className="flex flex-col gap-4">
        <h2 className="font-heading text-xl">Waitlist</h2>
        {waitlist.length === 0 ? (
          <p className="text-sm text-muted-foreground">No waitlist.</p>
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
                                Notify
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
          <h2 className="font-heading text-xl">This period</h2>
          <Card>
            <CardHeader className="gap-1">
              <CardDescription className="font-mono">
                {summary.from} → {summary.to}
              </CardDescription>
              <p className="font-mono text-sm">
                In {formatPeriodAmount(summary.inUsd, showLbp, displayRate)}
              </p>
              <p className="font-mono text-sm">
                Out {formatPeriodAmount(summary.outUsd, showLbp, displayRate)}
              </p>
              <p className="font-mono text-sm">
                Difference{" "}
                {formatPeriodAmount(summary.netUsd, showLbp, displayRate)}
              </p>
              {lbpNote ? (
                <p className="text-sm text-muted-foreground">{lbpNote}</p>
              ) : null}
            </CardHeader>
            <CardContent>
              <form method="get" action="/owner" className="flex flex-col gap-3">
                <input type="hidden" name="tenant" value={tenantSlug} />
                <div className="flex flex-col gap-2">
                  <Label htmlFor="from">From</Label>
                  <Input
                    id="from"
                    type="date"
                    name="from"
                    required
                    defaultValue={summary.from}
                    className="font-mono"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="to">To</Label>
                  <Input
                    id="to"
                    type="date"
                    name="to"
                    required
                    defaultValue={summary.to}
                    className="font-mono"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="view">View</Label>
                  <select
                    id="view"
                    name="view"
                    defaultValue={periodQuery.view}
                    className={nativeField}
                  >
                    <option value="usd">USD</option>
                    <option value="lbp">LBP</option>
                  </select>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="displayRate">Display rate</Label>
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
                  Show
                </Button>
              </form>
            </CardContent>
          </Card>
        </section>
      ) : null}

      <section className="flex flex-col gap-4">
        <h2 className="font-heading text-xl">Exchange rate</h2>
        <Card>
          <CardHeader>
            <CardDescription className="font-mono">
              {rate ? `${rate.toFixed(0)} LBP per USD` : "No rate set"}
            </CardDescription>
          </CardHeader>
          {isOwner ? (
            <CardContent>
              <form action={submitSetExchangeRate} className="flex flex-col gap-3">
                {keepOwnerQuery(tenantSlug, bookOn, periodQuery)}
                <div className="flex flex-col gap-2">
                  <Label htmlFor="lbpPerUsd">New rate</Label>
                  <Input
                    id="lbpPerUsd"
                    type="text"
                    name="lbpPerUsd"
                    required
                    inputMode="numeric"
                    className="font-mono"
                  />
                </div>
                <Button type="submit" variant="secondary" className="w-full">
                  Set rate
                </Button>
              </form>
            </CardContent>
          ) : null}
        </Card>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-heading text-xl">Expenses</h2>
        {mayRecordExpense ? (
          <Card>
            <CardContent>
              <form action={submitRecordExpense} className="flex flex-col gap-3">
                {keepOwnerQuery(tenantSlug, bookOn, periodQuery)}
                <div className="flex flex-col gap-2">
                  <Label htmlFor="category">Category</Label>
                  <select
                    id="category"
                    name="category"
                    required
                    defaultValue="ELECTRICITY"
                    className={nativeField}
                  >
                    {EXPENSE_CATEGORIES.map((category) => (
                      <option key={category} value={category}>
                        {categoryLabel(category)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="description">What</Label>
                  <Input
                    id="description"
                    type="text"
                    name="description"
                    required
                    maxLength={200}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="occurredOn">When</Label>
                  <Input
                    id="occurredOn"
                    type="date"
                    name="occurredOn"
                    required
                    defaultValue={today}
                    className="font-mono"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="expenseUsd">USD</Label>
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
                  <Label htmlFor="expenseLbp">LBP</Label>
                  <Input
                    id="expenseLbp"
                    type="text"
                    name="lbpAmount"
                    inputMode="numeric"
                    className="font-mono"
                  />
                </div>
                <Button type="submit" className="w-full">
                  Record expense
                </Button>
              </form>
            </CardContent>
          </Card>
        ) : null}
        {expenses.length === 0 ? (
          <p className="text-sm text-muted-foreground">No expenses yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {expenses.map((row) => (
              <li key={row.id} className="text-sm">
                {categoryLabel(row.category)} — {row.description} —{" "}
                <span className="font-mono">{formatLocalDay(row.occurredAt)}</span>{" "}
                —{" "}
                <span className="font-mono">${formatUsd(row.amountUsd)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function keepOwnerQuery(
  tenantSlug: string,
  bookOn: string,
  period: LedgerPeriodQuery,
) {
  return (
    <>
      <input type="hidden" name="tenant" value={tenantSlug} />
      <input type="hidden" name="bookOn" value={bookOn} />
      {period.from ? <input type="hidden" name="from" value={period.from} /> : null}
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

function formatLocalRange(start: Date, end: Date): string {
  return `${formatLocalTime(start)}–${formatLocalTime(end)} (${TIME_ZONE})`;
}

function formatLocalTime(value: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(value);
}

function formatLocalDateTime(value: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: TIME_ZONE,
    dateStyle: "medium",
    timeStyle: "short",
    hour12: false,
  }).format(value);
}

function formatLocalDay(value: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: TIME_ZONE,
    dateStyle: "medium",
  }).format(value);
}

function todayInTimeZone(timeZone: string): string {
  const map: Record<string, string> = {};
  for (const part of new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date())) {
    if (part.type !== "literal") map[part.type] = part.value;
  }
  return `${map.year}-${map.month}-${map.day}`;
}

function parseOwnerBookOn(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    civilFromYyyyMmDd(value);
    return value;
  } catch {
    return undefined;
  }
}

function civilFromYyyyMmDd(value: string): CivilDate {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    throw new Error(`Invalid bookOn "${value}"`);
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const utc = new Date(Date.UTC(year, month - 1, day));
  if (
    utc.getUTCFullYear() !== year ||
    utc.getUTCMonth() !== month - 1 ||
    utc.getUTCDate() !== day
  ) {
    throw new Error(`Invalid bookOn "${value}"`);
  }
  return { year, month, day };
}

function categoryLabel(category: (typeof EXPENSE_CATEGORIES)[number]): string {
  switch (category) {
    case "ELECTRICITY":
      return "Electricity";
    case "WATER":
      return "Water";
    case "MAINTENANCE":
      return "Maintenance";
    case "SALARY":
      return "Salary";
    case "EQUIPMENT":
      return "Equipment";
    case "OTHER":
      return "Other";
  }
}
