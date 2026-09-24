import Decimal from "decimal.js";
import { DomainError } from "@/lib/errors";
import db from "@/lib/db";
import { formatLocalHm } from "@/lib/format-local-hm";
import { logger } from "@/lib/logger";
import { getCurrentTenant } from "@/lib/tenant-context";
import { rethrowUnexpected } from "@/lib/use-case-error";
import { getCurrentMembership } from "@/modules/access/application/get-current-membership";
import { remainingDue } from "@/modules/payment/domain/collect";
import {
  listBookingsForStartDay,
  listEndedWithRemaining,
  type DayBookingRow,
  type DayBookingStatus,
} from "@/modules/booking/infrastructure/bookings";
import { summarizeDay, type DaySummary } from "@/modules/booking/domain/day-summary";
import { resolveOwnerDay } from "@/modules/booking/domain/start-day";
import {
  bookingConfirmedMessage,
  whatsAppHref,
} from "@/modules/notification/domain/whatsapp-link";
import {
  civilDateInTimeZone,
  civilDayUtcRange,
  compareCivilDate,
  type CivilDate,
} from "@/modules/venue/domain/availability";

const TIME_ZONE = "Asia/Beirut";
const TO_COLLECT_LIMIT = 5;

export type OwnerDayBooking = {
  id: string;
  status: DayBookingStatus;
  pitchName: string;
  start: Date;
  end: Date;
  priceUsd: Decimal;
  remaining: Decimal;
  requesterName: string;
  requesterPhone: string;
  confirmWhatsAppHref: string | null;
};

export type OwnerDay = {
  day: CivilDate;
  today: CivilDate;
  isToday: boolean;
  summary: DaySummary;
  games: OwnerDayBooking[];
  toCollect: OwnerDayBooking[];
  toCollectHasMore: boolean;
};

/**
 * One Beirut start-day for Today, plus today's To collect inbox.
 * listDueBookings is not used here.
 */
export async function loadOwnerDay(
  dateParam: string | undefined,
): Promise<OwnerDay> {
  const membership = await getCurrentMembership();
  if (!membership) {
    throw new DomainError("access.not_allowed");
  }

  const tenant = await getCurrentTenant();

  try {
    const now = new Date();
    const today = civilDateInTimeZone(now, TIME_ZONE);
    const day = resolveOwnerDay(dateParam, today);
    const range = civilDayUtcRange(day, TIME_ZONE);
    const isToday = compareCivilDate(day, today) === 0;

    const [gameRows, collectRows] = await Promise.all([
      listBookingsForStartDay(db, range.start, range.end),
      isToday
        ? listEndedWithRemaining(db, now, TO_COLLECT_LIMIT + 1)
        : Promise.resolve([]),
    ]);
    const summary = summarizeDay(gameRows, now);

    return {
      day,
      today,
      isToday,
      summary,
      games: gameRows.map((row) => toOwnerDayBooking(row, tenant.name, tenant.id)),
      toCollect: collectRows
        .slice(0, TO_COLLECT_LIMIT)
        .map((row) => toOwnerDayBooking(row, tenant.name, tenant.id)),
      toCollectHasMore: collectRows.length > TO_COLLECT_LIMIT,
    };
  } catch (error) {
    return await rethrowUnexpected(error, "Load owner day failed", "loadOwnerDay");
  }
}

function toOwnerDayBooking(
  row: DayBookingRow,
  stadiumName: string,
  tenantId: string,
): OwnerDayBooking {
  return {
    id: row.id,
    status: row.status,
    pitchName: row.pitchName,
    start: row.start,
    end: row.end,
    priceUsd: row.priceUsd,
    remaining: remainingDue(row.priceUsd, row.collectedUsd),
    requesterName: row.requesterName,
    requesterPhone: row.requesterPhone,
    confirmWhatsAppHref:
      row.status === "APPROVED"
        ? confirmHref(row, stadiumName, tenantId)
        : null,
  };
}

function confirmHref(
  row: DayBookingRow,
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
      useCase: "loadOwnerDay",
      tenantId,
    });
    return null;
  }
}
