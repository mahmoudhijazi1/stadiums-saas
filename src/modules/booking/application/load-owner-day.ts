import Decimal from "decimal.js";
import { DomainError } from "@/lib/errors";
import { requireUsd } from "@/modules/booking/domain/game-money";
import db from "@/lib/db";
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
  /** Null until the slot is named. */
  personId: string | null;
  /** Null until the slot is named. */
  name: string | null;
  dueUsd: Decimal;
  paidUsd: Decimal;
  remainingUsd: Decimal;
};

/** What every game on Today has, whatever its currency. */
type OwnerDayGame = {
  id: string;
  status: DayBookingStatus;
  pitchId: string;
  pitchName: string;
  start: Date;
  end: Date;
  collectedUsd: Decimal;
  /** Unpaid player tabs (shop items charged to a player). Never part of the booking due. */
  tabsRemainingUsd: Decimal;
  collectionMode: "WHOLE" | "PER_PLAYER";
  pitchDefaultPlayerCount: number;
  /** Empty on WHOLE. */
  slots: OwnerSlot[];
  /** Collected minus allocated. Zero on WHOLE. */
  unassignedUsd: Decimal;
  requesterPersonId: string;
  requesterName: string;
  requesterPhone: string | null;
};

/** A game priced in dollars: every money action works on it, as before. */
export type UsdOwnerDayBooking = OwnerDayGame & {
  currency: "USD";
  priceUsd: Decimal;
  amountDueUsd: Decimal;
  /** The booking only: due minus collected. "Booker pays all remaining" uses this, never the tabs. */
  remaining: Decimal;
  /** What the game still owes the stadium overall: the booking remaining (not below zero) plus the tabs. */
  owedUsd: Decimal;
};

/**
 * A game priced in pounds (DR-007 slice 5): shown in pounds, never collected yet (slices 6 to 9), so
 * nothing was paid on it and its due is what is left. Always WHOLE, no player slots.
 */
export type LbpOwnerDayBooking = OwnerDayGame & {
  currency: "LBP";
  priceLbp: Decimal;
  amountDueLbp: Decimal;
};

export type OwnerDayBooking = UsdOwnerDayBooking | LbpOwnerDayBooking;

export type OwnerDay = {
  /** Business date shown (06:00 to 06:00 Beirut). */
  day: CivilDate;
  /** Today's business date: before the tenant's day start hour it is still yesterday's calendar date. */
  today: CivilDate;
  isToday: boolean;
  /** Now is between midnight and the rollover: Today is still the previous night. */
  afterMidnight: boolean;
  summary: DaySummary;
  games: OwnerDayBooking[];
  /** USD only: the To collect read refuses an LBP game (an owed reader, DR-007 slice 9). */
  toCollect: UsdOwnerDayBooking[];
  toCollectHasMore: boolean;
};

/**
 * One Beirut business day for Today (from the tenant's day start hour, `businessDate`), plus today's To
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
    const today = businessDate(now, tenant.dayStartHour, TIME_ZONE);
    const day = resolveOwnerDay(dateParam, today);
    const range = businessDayUtcRange(day, tenant.dayStartHour, TIME_ZONE);
    const isToday = compareCivilDate(day, today) === 0;
    const afterMidnight =
      compareCivilDate(civilDateInTimeZone(now, TIME_ZONE), today) !== 0;

    const [gameRows, collectRows] = await Promise.all([
      listBookingsForStartDay(db, range.start, range.end),
      isToday
        ? listEndedWithRemaining(db, now, TO_COLLECT_LIMIT + 1)
        : Promise.resolve([]),
    ]);
    // The day's USD totals; an LBP game counts as a game but its pounds are not added to dollars
    // (per-currency totals are DR-007 slice 9). The summary is not shown on any screen.
    const summary = summarizeDay(
      gameRows.map((row) => ({
        status: row.status,
        start: row.start,
        end: row.end,
        amountDueUsd: row.amountDue.currency === "USD" ? row.amountDue.amount : new Decimal(0),
        collectedUsd: row.collectedUsd,
        tabsRemainingUsd: row.tabsRemainingUsd,
      })),
      now,
    );
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
        toOwnerDayBooking(row, slotsByBooking),
      ),
      toCollect: collectRows
        .slice(0, TO_COLLECT_LIMIT)
        .map((row) => toUsdOwnerDayBooking(row, slotsByBooking)),
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
      personId: row.personId,
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
  slotsByBooking: Map<string, OwnerSlot[]>,
): OwnerDayBooking {
  if (row.amountDue.currency === "LBP") {
    // Collecting an LBP game is refused until slice 6, so nothing can have been paid on it in dollars.
    if (row.collectedUsd.gt(0) || row.collectionMode !== "WHOLE") {
      throw new DomainError("booking.lbp_not_supported", { where: "owner-day.lbpCollected" });
    }
    return {
      ...gameFields(row, []),
      currency: "LBP",
      priceLbp: row.price.amount,
      amountDueLbp: row.amountDue.amount,
    };
  }
  return toUsdOwnerDayBooking(row, slotsByBooking);
}

function toUsdOwnerDayBooking(
  row: DayBookingRow,
  slotsByBooking: Map<string, OwnerSlot[]>,
): UsdOwnerDayBooking {
  const slots = slotsByBooking.get(row.id) ?? [];
  const amountDueUsd = requireUsd(row.amountDue, "owner-day.amountDueUsd");
  return {
    ...gameFields(row, slots),
    currency: "USD",
    priceUsd: requireUsd(row.price, "owner-day.priceUsd"),
    amountDueUsd,
    remaining: bookingRemaining(amountDueUsd, row.collectedUsd),
    owedUsd: Decimal.max(bookingRemaining(amountDueUsd, row.collectedUsd), 0).plus(row.tabsRemainingUsd),
  };
}

function gameFields(row: DayBookingRow, slots: OwnerSlot[]): OwnerDayGame {
  const allocated = slots.reduce((sum, slot) => sum.plus(slot.paidUsd), new Decimal(0));
  return {
    id: row.id,
    status: row.status,
    pitchId: row.pitchId,
    pitchName: row.pitchName,
    start: row.start,
    end: row.end,
    collectedUsd: row.collectedUsd,
    tabsRemainingUsd: row.tabsRemainingUsd,
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
  };
}
