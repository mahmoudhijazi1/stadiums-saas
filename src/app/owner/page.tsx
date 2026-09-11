import { redirect } from "next/navigation";
import { ZodError } from "zod";
import Decimal from "decimal.js";
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

const TIME_ZONE = "Asia/Beirut";

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
  const failed = params.error === "1";
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
    <main style={{ fontFamily: "system-ui", padding: "1.5rem", lineHeight: 1.6 }}>
      <h1>{tenant.name}</h1>
      <p>
        Signed in as <code>{membership.identifier}</code> ({membership.role})
      </p>
      <form action={submitLogout}>
        <input type="hidden" name="tenant" value={tenantSlug} />
        <button type="submit">Log out</button>
      </form>
      {failed ? <p>Could not save</p> : null}

      {summary ? (
        <>
          <h2>This period</h2>
          <p>
            {summary.from} → {summary.to}
          </p>
          <p>In {formatPeriodAmount(summary.inUsd, showLbp, displayRate)}</p>
          <p>Out {formatPeriodAmount(summary.outUsd, showLbp, displayRate)}</p>
          <p>
            Difference {formatPeriodAmount(summary.netUsd, showLbp, displayRate)}
          </p>
          {lbpNote ? <p>{lbpNote}</p> : null}
          <form method="get" action="/owner">
            <input type="hidden" name="tenant" value={tenantSlug} />
            <label>
              From{" "}
              <input
                type="date"
                name="from"
                required
                defaultValue={summary.from}
              />
            </label>{" "}
            <label>
              To{" "}
              <input
                type="date"
                name="to"
                required
                defaultValue={summary.to}
              />
            </label>{" "}
            <label>
              View{" "}
              <select name="view" defaultValue={periodQuery.view}>
                <option value="usd">USD</option>
                <option value="lbp">LBP</option>
              </select>
            </label>{" "}
            <label>
              Display rate{" "}
              <input
                type="text"
                name="displayRate"
                inputMode="numeric"
                placeholder="90000"
                defaultValue={periodQuery.displayRate ?? ""}
              />
            </label>{" "}
            <button type="submit">Show</button>
          </form>
        </>
      ) : null}

      <h2>Exchange rate</h2>
      <p>
        {rate ? (
          <>
            {rate.toFixed(0)} LBP per USD
          </>
        ) : (
          "No rate set"
        )}
      </p>
      {isOwner ? (
        <form action={submitSetExchangeRate}>
          <input type="hidden" name="tenant" value={tenantSlug} />
          <label>
            New rate{" "}
            <input type="text" name="lbpPerUsd" required inputMode="numeric" />
          </label>{" "}
          <button type="submit">Set rate</button>
        </form>
      ) : null}

      <h2>Pending requests</h2>
      {pending.length === 0 ? (
        <p>No pending requests.</p>
      ) : (
        <ul>
          {pending.map((row) => (
            <li key={row.id}>
              <strong>{row.pitchName}</strong>{" "}
              {formatLocalRange(row.start, row.end)} — {row.requesterName}{" "}
              <code>{row.requesterPhone}</code>
              <br />
              Requested {formatLocalDateTime(row.requestedAt)}
              {mayDecide ? (
                <>
                  <form action={submitApproveBooking}>
                    <input type="hidden" name="bookingId" value={row.id} />
                    <input type="hidden" name="tenant" value={tenantSlug} />
                    <button type="submit">Approve</button>
                  </form>
                  <form action={submitRejectBooking}>
                    <input type="hidden" name="bookingId" value={row.id} />
                    <input type="hidden" name="tenant" value={tenantSlug} />
                    <button type="submit">Reject</button>
                  </form>
                </>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {mayCreateBooking ? (
        <>
          <h2>Book a slot</h2>
          <form method="get" action="/owner">
            <input type="hidden" name="tenant" value={tenantSlug} />
            <label>
              Day{" "}
              <input type="date" name="bookOn" required defaultValue={bookOn} />
            </label>{" "}
            <button type="submit">Show slots</button>
          </form>
          {bookPitches.length === 0 ? (
            <p>No pitches yet.</p>
          ) : (
            <ul>
              {bookPitches.map((pitch) => (
                <li key={pitch.id}>
                  <strong>{pitch.name}</strong>
                  {pitch.slots.length === 0 ? (
                    <p>Closed / No slots.</p>
                  ) : (
                    <ul>
                      {pitch.slots.map((slot) => (
                        <li key={slot.startIso}>
                          {slot.startLocal}–{slot.endLocal} · ${slot.priceUsd}
                          {slot.available ? (
                            <form action={submitCreateOwnerBooking}>
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
                              <input type="hidden" name="end" value={slot.endIso} />
                              <input type="hidden" name="tenant" value={tenantSlug} />
                              <input type="hidden" name="bookOn" value={bookOn} />
                              <label>
                                Name{" "}
                                <input
                                  type="text"
                                  name="name"
                                  required
                                  autoComplete="name"
                                />
                              </label>{" "}
                              <label>
                                Phone{" "}
                                <input
                                  type="tel"
                                  name="phone"
                                  required
                                  autoComplete="tel"
                                />
                              </label>{" "}
                              <button type="submit">Book</button>
                            </form>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      ) : null}

      <h2>Confirmed bookings</h2>
      {confirmed.length === 0 ? (
        <p>No confirmed bookings.</p>
      ) : (
        <ul>
          {confirmed.map((row) => (
            <li key={row.id}>
              <strong>{row.pitchName}</strong>{" "}
              {formatLocalRange(row.start, row.end)} — {row.requesterName}{" "}
              <code>{row.requesterPhone}</code>
              <br />
              Due ${formatUsd(row.priceUsd)} · remaining ${formatUsd(row.remaining)}
              {mayCollect && row.remaining.gt(0) ? (
                <>
                  <form action={submitCollectPayment}>
                    <input type="hidden" name="bookingId" value={row.id} />
                    <input type="hidden" name="tenant" value={tenantSlug} />
                    <input
                      type="hidden"
                      name="usdAmount"
                      value={formatUsd(row.remaining)}
                    />
                    <button type="submit">
                      Collect ${formatUsd(row.remaining)} USD
                    </button>
                  </form>
                  <form action={submitCollectPayment}>
                    <input type="hidden" name="bookingId" value={row.id} />
                    <input type="hidden" name="tenant" value={tenantSlug} />
                    <label>
                      USD{" "}
                      <input
                        type="text"
                        name="usdAmount"
                        inputMode="decimal"
                        placeholder="30.00"
                      />
                    </label>{" "}
                    <label>
                      LBP{" "}
                      <input type="text" name="lbpAmount" inputMode="numeric" />
                    </label>{" "}
                    <button type="submit">Collect mixed</button>
                  </form>
                </>
              ) : null}
              {mayCancel ? (
                <form action={submitCancelBooking}>
                  <input type="hidden" name="bookingId" value={row.id} />
                  <input type="hidden" name="tenant" value={tenantSlug} />
                  <input type="hidden" name="bookOn" value={bookOn} />
                  <button type="submit">Cancel</button>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <h2>Waitlist</h2>
      {waitlist.length === 0 ? (
        <p>No waitlist.</p>
      ) : (
        <ul>
          {waitlist.map((group) => (
            <li key={`${group.pitchId}-${group.start.toISOString()}`}>
              <strong>{group.pitchName}</strong>{" "}
              {formatLocalRange(group.start, group.end)}
              <ul>
                {group.people.map((person) => (
                  <li key={person.personId}>
                    {person.name} <code>{person.phone}</code>
                    {person.whatsAppHref ? (
                      <>
                        {" "}
                        <a
                          href={person.whatsAppHref}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Notify
                        </a>
                      </>
                    ) : null}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}

      <h2>Expenses</h2>
      {mayRecordExpense ? (
        <form action={submitRecordExpense}>
          <input type="hidden" name="tenant" value={tenantSlug} />
          <label>
            Category{" "}
            <select name="category" required defaultValue="ELECTRICITY">
              {EXPENSE_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {categoryLabel(category)}
                </option>
              ))}
            </select>
          </label>{" "}
          <label>
            What{" "}
            <input type="text" name="description" required maxLength={200} />
          </label>{" "}
          <label>
            When{" "}
            <input type="date" name="occurredOn" required defaultValue={today} />
          </label>{" "}
          <label>
            USD{" "}
            <input
              type="text"
              name="usdAmount"
              inputMode="decimal"
              placeholder="30.00"
            />
          </label>{" "}
          <label>
            LBP{" "}
            <input type="text" name="lbpAmount" inputMode="numeric" />
          </label>{" "}
          <button type="submit">Record expense</button>
        </form>
      ) : null}
      {expenses.length === 0 ? (
        <p>No expenses yet.</p>
      ) : (
        <ul>
          {expenses.map((row) => (
            <li key={row.id}>
              {categoryLabel(row.category)} — {row.description} —{" "}
              {formatLocalDay(row.occurredAt)} — ${formatUsd(row.amountUsd)}
            </li>
          ))}
        </ul>
      )}
    </main>
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
