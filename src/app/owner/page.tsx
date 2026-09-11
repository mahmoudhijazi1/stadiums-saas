import { redirect } from "next/navigation";
import { getCurrentTenant } from "@/lib/tenant-context";
import { formatUsd } from "@/lib/money";
import { getCurrentMembership } from "@/modules/access/application/get-current-membership";
import {
  BOOKINGS_APPROVE,
  EXPENSES_RECORD,
  PAYMENTS_COLLECT,
  can,
} from "@/modules/access/domain/can";
import { listDueBookings } from "@/modules/booking/application/list-due-bookings";
import { listPendingRequests } from "@/modules/booking/application/list-pending-requests";
import { listRecentExpenses } from "@/modules/expense/application/list-recent-expenses";
import { EXPENSE_CATEGORIES } from "@/modules/expense/domain/categories";
import { getCurrentRate } from "@/modules/payment/application/get-current-rate";
import { submitLogout } from "@/app/login/actions";
import {
  submitApproveBooking,
  submitCollectPayment,
  submitRecordExpense,
  submitRejectBooking,
  submitSetExchangeRate,
} from "@/app/owner/actions";

const TIME_ZONE = "Asia/Beirut";

/**
 * Thin locked page. No Prisma and no tenantId.
 * Pending inbox (SPEC-05) + rate + collect (SPEC-06) + expenses (SPEC-07).
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
  const due = await listDueBookings();
  const expenses = await listRecentExpenses();
  const rate = await getCurrentRate();
  const mayDecide = can(membership, BOOKINGS_APPROVE);
  const mayCollect = can(membership, PAYMENTS_COLLECT);
  const mayRecordExpense = can(membership, EXPENSES_RECORD);
  const isOwner = membership.role === "OWNER";
  const failed = params.error === "1";
  const today = todayInTimeZone(TIME_ZONE);

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

      <h2>Due bookings</h2>
      {due.length === 0 ? (
        <p>No money due.</p>
      ) : (
        <ul>
          {due.map((row) => (
            <li key={row.id}>
              <strong>{row.pitchName}</strong>{" "}
              {formatLocalRange(row.start, row.end)} — {row.requesterName}{" "}
              <code>{row.requesterPhone}</code>
              <br />
              Due ${formatUsd(row.priceUsd)} · remaining ${formatUsd(row.remaining)}
              {mayCollect ? (
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
