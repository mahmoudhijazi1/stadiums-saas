import { redirect } from "next/navigation";
import { getCurrentTenant } from "@/lib/tenant-context";
import { formatUsd } from "@/lib/money";
import { getCurrentMembership } from "@/modules/access/application/get-current-membership";
import {
  BOOKINGS_APPROVE,
  PAYMENTS_COLLECT,
  can,
} from "@/modules/access/domain/can";
import { listDueBookings } from "@/modules/booking/application/list-due-bookings";
import { listPendingRequests } from "@/modules/booking/application/list-pending-requests";
import { getCurrentRate } from "@/modules/payment/application/get-current-rate";
import { submitLogout } from "@/app/login/actions";
import {
  submitApproveBooking,
  submitCollectPayment,
  submitRejectBooking,
  submitSetExchangeRate,
} from "@/app/owner/actions";

const TIME_ZONE = "Asia/Beirut";

/**
 * Thin locked page. No Prisma and no tenantId.
 * Pending inbox (SPEC-05) + rate + collect due list (SPEC-06).
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
  const rate = await getCurrentRate();
  const mayDecide = can(membership, BOOKINGS_APPROVE);
  const mayCollect = can(membership, PAYMENTS_COLLECT);
  const isOwner = membership.role === "OWNER";
  const failed = params.error === "1";

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
