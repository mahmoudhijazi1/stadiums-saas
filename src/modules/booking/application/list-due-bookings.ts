import Decimal from "decimal.js";
import { DomainError } from "@/lib/errors";
import db from "@/lib/db";
import { formatLocalHm } from "@/lib/format-local-hm";
import { logger } from "@/lib/logger";
import { getCurrentTenant } from "@/lib/tenant-context";
import { rethrowUnexpected } from "@/lib/use-case-error";
import { getCurrentMembership } from "@/modules/access/application/get-current-membership";
import { remainingDue } from "@/modules/payment/domain/collect";
import { sumCollectedUsdBySourceIds } from "@/modules/payment/infrastructure/payments";
import {
  listApprovedBookingsInRange,
  listApprovedBookingsStartingBefore,
  type ApprovedCollectRow,
  type HomeCollectStatus,
} from "@/modules/booking/infrastructure/bookings";
import { partitionHomeConfirmed } from "@/modules/booking/domain/home-inbox";
import {
  addCalendarDays,
  civilDateInTimeZone,
  civilDayUtcRange,
} from "@/modules/venue/domain/availability";
import {
  bookingConfirmedMessage,
  whatsAppHref,
} from "@/modules/notification/domain/whatsapp-link";

const TIME_ZONE = "Asia/Beirut";
/** Owner Home “coming days” booking list horizon (not the public day-chip count). */
const COMING_DAYS = 7;

export type DueBooking = {
  id: string;
  status: HomeCollectStatus;
  pitchName: string;
  start: Date;
  end: Date;
  priceUsd: Decimal;
  remaining: Decimal;
  requesterName: string;
  requesterPhone: string;
  confirmWhatsAppHref: string | null;
};

export type HomeConfirmedLists = {
  overdue: DueBooking[];
  today: DueBooking[];
  later: DueBooking[];
};

/**
 * Home confirmed lists (BR-49 overdue + today + next 7 days).
 * Staff may look. Remaining from Payment sums — Booking does not join
 * payment tables. Paid today/later stay so Cancel is reachable (SPEC-10).
 * Paid-before-today is omitted; unpaid-before-today is overdue.
 * Unpaid NO_SHOW stays (Collect); paid NO_SHOW is omitted (SPEC-14).
 * Confirm wa.me is APPROVED-only (BR-71); built here, not a Server Action.
 */
export async function listDueBookings(): Promise<HomeConfirmedLists> {
  const membership = await getCurrentMembership();
  if (!membership) {
    throw new DomainError("access.not_allowed");
  }

  // Tenant / notFound stay outside try — must not become UnexpectedError.
  const tenant = await getCurrentTenant();

  try {
    const now = new Date();
    const today = civilDateInTimeZone(now, TIME_ZONE);
    const todayStart = civilDayUtcRange(today, TIME_ZONE).start;
    const horizonEnd = civilDayUtcRange(
      addCalendarDays(today, COMING_DAYS + 1),
      TIME_ZONE,
    ).start;

    const [windowRows, pastRows] = await Promise.all([
      listApprovedBookingsInRange(db, todayStart, horizonEnd),
      listApprovedBookingsStartingBefore(db, todayStart),
    ]);

    const collected = await sumCollectedUsdBySourceIds(
      db,
      "BOOKING",
      [...windowRows, ...pastRows].map((row) => row.id),
    );

    const withRemaining = [...pastRows, ...windowRows].map((row) =>
      toDueBooking(
        row,
        collected.get(row.id) ?? new Decimal(0),
        tenant.name,
        tenant.id,
      ),
    );
    const visible = withRemaining.filter(
      (row) => row.status === "APPROVED" || row.remaining.gt(0),
    );

    return partitionHomeConfirmed(visible, now, TIME_ZONE);
  } catch (error) {
    return await rethrowUnexpected(
      error,
      "List due bookings failed",
      "listDueBookings",
    );
  }
}

function toDueBooking(
  row: ApprovedCollectRow,
  collectedUsd: Decimal,
  stadiumName: string,
  tenantId: string,
): DueBooking {
  return {
    id: row.id,
    status: row.status,
    pitchName: row.pitchName,
    start: row.start,
    end: row.end,
    priceUsd: row.priceUsd,
    remaining: remainingDue(row.priceUsd, collectedUsd),
    requesterName: row.requesterName,
    requesterPhone: row.requesterPhone,
    confirmWhatsAppHref:
      row.status === "APPROVED"
        ? confirmHref(row, stadiumName, tenantId)
        : null,
  };
}

/**
 * wa.me for confirm. Bad phone → null (RULE-9 / DR-004: do not block the list).
 * info (not error): expected data issue, not a system bug. Does not log the phone.
 */
function confirmHref(
  row: ApprovedCollectRow,
  stadiumName: string,
  tenantId: string,
): string | null {
  try {
    return whatsAppHref(
      row.requesterPhone,
      bookingConfirmedMessage({
        stadiumName,
        pitchName: row.pitchName,
        startLocal: formatLocalHm(row.start, TIME_ZONE),
        endLocal: formatLocalHm(row.end, TIME_ZONE),
      }),
    );
  } catch (error) {
    logger.info("Confirm WhatsApp link skipped", error, {
      useCase: "listDueBookings",
      tenantId,
    });
    return null;
  }
}
