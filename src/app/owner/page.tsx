import { redirect } from "next/navigation";
import { getCurrentTenant } from "@/lib/tenant-context";
import { getCurrentMembership } from "@/modules/access/application/get-current-membership";
import { BOOKINGS_APPROVE, can } from "@/modules/access/domain/can";
import { listPendingRequests } from "@/modules/booking/application/list-pending-requests";
import { submitLogout } from "@/app/login/actions";
import {
  submitApproveBooking,
  submitRejectBooking,
} from "@/app/owner/actions";

const TIME_ZONE = "Asia/Beirut";

/**
 * Thin locked page. No Prisma and no tenantId.
 * Pending inbox + approve/reject forms (SPEC-05). Staff see the list, no buttons.
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
  const mayDecide = can(membership, BOOKINGS_APPROVE);
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
      <h2>Pending requests</h2>
      {failed ? <p>Could not update request</p> : null}
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
