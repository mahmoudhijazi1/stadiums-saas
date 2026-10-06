import { hasSeveralPitches } from "@/modules/venue/application/has-several-pitches";
import Decimal from "decimal.js";
import { DomainError } from "@/lib/errors";
import db from "@/lib/db";
import { messageDayLabel } from "@/modules/booking/application/night-hint";
import { formatLocalHm } from "@/lib/format-local-hm";
import { getUiLocale } from "@/lib/get-ui-locale";
import { logger } from "@/lib/logger";
import { getCurrentTenant } from "@/lib/tenant-context";
import { rethrowUnexpected } from "@/lib/use-case-error";
import { getCurrentMembership } from "@/modules/access/application/get-current-membership";
import {
  bookingRemaining,
  participantRemaining,
  unassignedUsd,
} from "@/modules/payment/domain/collect";
import {
  listBookingsForStartDay,
  listEndedWithRemaining,
  listSlotsForBookings,
  type DayBookingRow,
  type DayBookingStatus,
  type SlotRow,
} from "@/modules/booking/infrastructure/bookings";
import { summarizeDay, type DaySummary } from "@/modules/booking/domain/day-summary";
import { resolveOwnerDay } from "@/modules/booking/domain/start-day";
import {
  bookingConfirmedMessage,
  whatsAppHref,
} from "@/modules/notification/domain/whatsapp-link";
import {
  businessDate,
  businessDayUtcRange,
} from "@/modules/booking/domain/business-day";
import {
  civilDateInTimeZone,
  compareCivilDate,
  type CivilDate,
} from "@/modules/venue/domain/availability";

const TIME_ZONE = "Asia/Beirut";
const TO_COLLECT_LIMIT = 5;

/** One player slot on a PER_PLAYER booking (SPEC-15). */
export type OwnerSlot = {
  participantId: string;
  slotNumber: number;
  isRequester: boolean;
  /** Null until the slot is named (slice 4). */
  name: string | null;
  dueUsd: Decimal;
  paidUsd: Decimal;
  remainingUsd: Decimal;
};

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
  pitchDefaultPlayerCount: number;
  /** Empty on WHOLE. */
  slots: OwnerSlot[];
  /** Collected minus allocated. Zero on WHOLE. */
  unassignedUsd: Decimal;
  requesterPersonId: string;
  requesterName: string;
  requesterPhone: string | null;
  confirmWhatsAppHref: string | null;
};

export type OwnerDay = {
  /** Business date shown (06:00 to 06:00 Beirut). */
  day: CivilDate;
  /** Today's business date: before 06:00 it is still yesterday's calendar date. */
  today: CivilDate;
  isToday: boolean;
  /** Now is between midnight and the rollover: Today is still the previous night. */
  afterMidnight: boolean;
  summary: DaySummary;
  games: OwnerDayBooking[];
  toCollect: OwnerDayBooking[];
  toCollectHasMore: boolean;
};

/**
 * One Beirut business day for Today (06:00 to 06:00, `businessDate`), plus today's To
 * collect inbox. A game starting at 00:30 Saturday is on Friday. `now` is injectable for tests.
 */
export async function loadOwnerDay(
  dateParam: string | undefined,
  now: Date = new Date(),
): Promise<OwnerDay> {
  const membership = await getCurrentMembership();
  if (!membership) {
    throw new DomainError("access.not_allowed");
  }

  const tenant = await getCurrentTenant();

  try {
    const today = businessDate(now, TIME_ZONE);
    const day = resolveOwnerDay(dateParam, today);
    const range = businessDayUtcRange(day, TIME_ZONE);
    const isToday = compareCivilDate(day, today) === 0;
    const afterMidnight =
      compareCivilDate(civilDateInTimeZone(now, TIME_ZONE), today) !== 0;

    const [gameRows, collectRows] = await Promise.all([
      listBookingsForStartDay(db, range.start, range.end),
      isToday
        ? listEndedWithRemaining(db, now, TO_COLLECT_LIMIT + 1)
        : Promise.resolve([]),
    ]);
    const summary = summarizeDay(gameRows, now);
    const locale = await getUiLocale();
    const showPitch = await hasSeveralPitches();
    const slotsByBooking = groupSlots(
      await listSlotsForBookings(
        db,
        [...gameRows, ...collectRows]
          .filter((row) => row.collectionMode === "PER_PLAYER")
          .map((row) => row.id),
      ),
    );

    return {
      day,
      today,
      isToday,
      afterMidnight,
      summary,
      games: gameRows.map((row) =>
        toOwnerDayBooking(row, tenant.name, tenant.id, locale, tenant.timeDisplay, slotsByBooking, showPitch),
      ),
      toCollect: collectRows
        .slice(0, TO_COLLECT_LIMIT)
        .map((row) =>
          toOwnerDayBooking(row, tenant.name, tenant.id, locale, tenant.timeDisplay, slotsByBooking, showPitch),
        ),
      toCollectHasMore: collectRows.length > TO_COLLECT_LIMIT,
    };
  } catch (error) {
    return await rethrowUnexpected(error, "Load owner day failed", "loadOwnerDay");
  }
}

function groupSlots(rows: SlotRow[]): Map<string, OwnerSlot[]> {
  const byBooking = new Map<string, OwnerSlot[]>();
  for (const row of rows) {
    const list = byBooking.get(row.bookingId) ?? [];
    list.push({
      participantId: row.participantId,
      slotNumber: row.slotNumber,
      isRequester: row.isRequester,
      name: row.name,
      dueUsd: row.dueUsd,
      paidUsd: row.paidUsd,
      remainingUsd: participantRemaining(row.dueUsd, row.paidUsd),
    });
    byBooking.set(row.bookingId, list);
  }
  return byBooking;
}

function toOwnerDayBooking(
  row: DayBookingRow,
  stadiumName: string,
  tenantId: string,
  locale: "ar" | "en",
  hourCycle: "h23" | "h12",
  slotsByBooking: Map<string, OwnerSlot[]>,
  showPitch: boolean,
): OwnerDayBooking {
  const slots = slotsByBooking.get(row.id) ?? [];
  const allocated = slots.reduce((sum, slot) => sum.plus(slot.paidUsd), new Decimal(0));
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
    pitchDefaultPlayerCount: row.pitchDefaultPlayerCount,
    slots,
    unassignedUsd:
      row.collectionMode === "PER_PLAYER"
        ? unassignedUsd(row.collectedUsd, allocated)
        : new Decimal(0),
    requesterPersonId: row.requesterPersonId,
    requesterName: row.requesterName,
    requesterPhone: row.requesterPhone,
    confirmWhatsAppHref:
      row.status === "APPROVED"
        ? confirmHref(row, stadiumName, tenantId, locale, hourCycle, showPitch)
        : null,
  };
}

function confirmHref(
  row: DayBookingRow,
  stadiumName: string,
  tenantId: string,
  locale: "ar" | "en",
  hourCycle: "h23" | "h12",
  showPitch: boolean,
): string | null {
  if (!row.requesterPhone) return null;
  try {
    return whatsAppHref(
      row.requesterPhone,
      bookingConfirmedMessage({
        name: row.requesterName,
        stadiumName,
        day: messageDayLabel(row.start, locale),
        time: formatLocalHm(row.start, TIME_ZONE, hourCycle, locale),
        pitchName: showPitch ? row.pitchName : null,
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
