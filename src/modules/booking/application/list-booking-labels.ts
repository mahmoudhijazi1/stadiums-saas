import { DomainError } from "@/lib/errors";
import db from "@/lib/db";
import { getCurrentTenant } from "@/lib/tenant-context";
import { rethrowUnexpected } from "@/lib/use-case-error";
import { getCurrentMembership } from "@/modules/access/application/get-current-membership";
import { REPORTS_VIEW, can } from "@/modules/access/domain/can";
import { businessDate } from "@/modules/booking/domain/business-day";
import { listBookingLabelRows } from "@/modules/booking/infrastructure/bookings";
import { formatCivilDate } from "@/modules/venue/domain/availability";

export type BookingLabel = {
  id: string;
  requesterName: string | null;
  personId: string | null;
  /** The business day the game belongs to (`YYYY-MM-DD`), for a link into Today. */
  businessDay: string;
};

const TIME_ZONE = "Asia/Beirut";

/**
 * Who a game was for, for many bookings in one query: the labels on the Money activity
 * list. reports.view, like the list that asks. Booking owns this read; ledger never imports it.
 */
export async function listBookingLabels(ids: string[]): Promise<Map<string, BookingLabel>> {
  const membership = await getCurrentMembership();
  if (!membership || !can(membership, REPORTS_VIEW)) {
    throw new DomainError("access.not_allowed");
  }
  const unique = [...new Set(ids)];
  if (unique.length === 0) return new Map();

  try {
    const tenant = await getCurrentTenant();
    const rows = await listBookingLabelRows(db, unique);
    return new Map(
      rows.map((row) => [
        row.id,
        {
          id: row.id,
          requesterName: row.requesterName,
          personId: row.personId,
          businessDay: formatCivilDate(businessDate(row.start, tenant.dayStartHour, TIME_ZONE)),
        },
      ]),
    );
  } catch (error) {
    return await rethrowUnexpected(error, "List booking labels failed", "listBookingLabels");
  }
}
