import Decimal from "decimal.js";
import { DomainError } from "@/lib/errors";
import db from "@/lib/db";
import { formatDisplayDate } from "@/lib/format-display-date";
import { formatLocalHm } from "@/lib/format-local-hm";
import { getUiLocale } from "@/lib/get-ui-locale";
import { logger } from "@/lib/logger";
import { getCurrentTenant } from "@/lib/tenant-context";
import { rethrowUnexpected } from "@/lib/use-case-error";
import { getCurrentMembership } from "@/modules/access/application/get-current-membership";
import { bookingRemaining } from "@/modules/payment/domain/collect";
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
  pitchId: string;
  pitchName: string;
  start: Date;
  end: Date;
  priceUsd: Decimal;
  amountDueUsd: Decimal;
  remaining: Decimal;
  collectedUsd: Decimal;
  collectionMode: "WHOLE" | "PER_PLAYER";
  requesterPersonId: string;
  requesterName: string;
  requesterPhone: string | null;
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
    const locale = await getUiLocale();

    return {
      day,
      today,
      isToday,
      summary,
      games: gameRows.map((row) =>
        toOwnerDayBooking(row, tenant.name, tenant.id, locale, tenant.timeDisplay),
      ),
      toCollect: collectRows
        .slice(0, TO_COLLECT_LIMIT)
        .map((row) =>
          toOwnerDayBooking(row, tenant.name, tenant.id, locale, tenant.timeDisplay),
        ),
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
  locale: "ar" | "en",
  hourCycle: "h23" | "h12",
): OwnerDayBooking {
  return {
    id: row.id,
    status: row.status,
    pitchId: row.pitchId,
    pitchName: row.pitchName,
    start: row.start,
    end: row.end,
    priceUsd: row.priceUsd,
    amountDueUsd: row.amountDueUsd,
    remaining: bookingRemaining(row.amountDueUsd, row.collectedUsd),
    collectedUsd: row.collectedUsd,
    collectionMode: row.collectionMode,
    requesterPersonId: row.requesterPersonId,
    requesterName: row.requesterName,
    requesterPhone: row.requesterPhone,
    confirmWhatsAppHref:
      row.status === "APPROVED"
        ? confirmHref(row, stadiumName, tenantId, locale, hourCycle)
        : null,
  };
}

function confirmHref(
  row: DayBookingRow,
  stadiumName: string,
  tenantId: string,
  locale: "ar" | "en",
  hourCycle: "h23" | "h12",
): string | null {
  if (!row.requesterPhone) return null;
  try {
    return whatsAppHref(
      row.requesterPhone,
      bookingConfirmedMessage({
        name: row.requesterName,
        stadiumName,
        day: formatDisplayDate(row.start, locale, {
          weekday: "long",
          day: "numeric",
          month: "long",
        }),
        time: formatLocalHm(row.start, TIME_ZONE, hourCycle, locale),
        pitchName: row.pitchName,
        locale,
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
