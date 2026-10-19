import Decimal from "decimal.js";
import { DomainError } from "@/lib/errors";
import { addParts, noParts, type Parts } from "@/modules/booking/domain/game-owing";
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
  /** The game's currency: `due`, `paid` and `remaining` are dollars on a USD game, pounds on an LBP game. */
  currency: "USD" | "LBP";
  due: Decimal;
  paid: Decimal;
  remaining: Decimal;
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
  /**
   * What the game still owes the stadium overall, per currency (never added together): the booking
   * remaining (not below zero) in the game's currency plus the player tabs, which are dollars.
   */
  owedUsd: Decimal;
  owedLbp: Decimal;
  collectionMode: "WHOLE" | "PER_PLAYER";
  pitchDefaultPlayerCount: number;
  /** Empty on WHOLE. */
  slots: OwnerSlot[];
  /** Collected minus allocated, on a USD game. Zero on WHOLE and on an LBP game (see `unassignedLbp`). */
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
};

/**
 * A game priced in pounds (DR-007): its due, what its settlements applied and what is left, all in
 * pounds. Collect and the per-player split work on it; fees, extensions and adjust-due are hidden
 * until their slice lands.
 */
export type LbpOwnerDayBooking = OwnerDayGame & {
  currency: "LBP";
  priceLbp: Decimal;
  amountDueLbp: Decimal;
  settledLbp: Decimal;
  /** Due minus settled. */
  remainingLbp: Decimal;
  /** Settled minus allocated to slots (money from before the split). Zero on WHOLE. */
  unassignedLbp: Decimal;
};

/** What a game owes the stadium overall, per currency: its own remaining plus its player tabs (dollars). */
export function owedPartsOf(row: OwnerDayBooking): Parts {
  return { usd: row.owedUsd, lbp: row.owedLbp };
}

/** The sum of what these games owe, per currency (never added across them). */
export function sumOwedParts(rows: readonly OwnerDayBooking[]): Parts {
  return rows.reduce((sum, row) => addParts(sum, owedPartsOf(row)), noParts());
}

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
  /** Games from earlier days still owed, in either currency. */
  toCollect: OwnerDayBooking[];
  toCollectHasMore: boolean;
  /**
   * The exact total owed by ALL games from earlier days, per currency, not the sum of the capped
   * `toCollect` page. Zero on a day that is not today.
   */
  toCollectOwed: Parts;
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
        ? listEndedWithRemaining(db, now)
        : Promise.resolve([]),
    ]);
    // Per currency: dollars from USD games, pounds from LBP games, never added together.
    const summary = summarizeDay(
      gameRows.map((row) => ({
        status: row.status,
        start: row.start,
        end: row.end,
        collectedUsd: row.collectedUsd,
        tabsRemainingUsd: row.tabsRemainingUsd,
        ...(row.amountDue.currency === "LBP"
          ? { amountDueLbp: row.amountDue.amount, settledLbp: row.settledLbp }
          : { amountDueUsd: row.amountDue.amount }),
      })),
      now,
    );
    const slotsByBooking = groupSlots(
      await listSlotsForBookings(
        db,
        [...gameRows, ...collectRows].filter((row) => row.collectionMode === "PER_PLAYER").map((row) => row.id),
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
        .map((row) => toOwnerDayBooking(row, slotsByBooking)),
      toCollectHasMore: collectRows.length > TO_COLLECT_LIMIT,
      toCollectOwed: sumOwedParts(
        collectRows
          .filter((row) => compareCivilDate(businessDate(row.start, tenant.dayStartHour, TIME_ZONE), today) < 0)
          .map((row) => toOwnerDayBooking(row, slotsByBooking)),
      ),
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
      currency: row.currency,
      due: row.due,
      paid: row.paid,
      remaining: participantRemaining(row.due, row.paid),
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
    const remainingLbp = bookingRemaining(row.amountDue.amount, row.settledLbp);
    const slots = slotsByBooking.get(row.id) ?? [];
    const allocated = slots.reduce((sum, slot) => sum.plus(slot.paid), new Decimal(0));
    return {
      ...gameFields(row, slots, row.tabsRemainingUsd, Decimal.max(remainingLbp, 0)),
      currency: "LBP",
      priceLbp: row.price.amount,
      amountDueLbp: row.amountDue.amount,
      settledLbp: row.settledLbp,
      remainingLbp,
      unassignedLbp: row.collectionMode === "PER_PLAYER" ? row.settledLbp.minus(allocated) : new Decimal(0),
    };
  }
  return toUsdOwnerDayBooking(row, slotsByBooking);
}

function toUsdOwnerDayBooking(
  row: DayBookingRow,
  slotsByBooking: Map<string, OwnerSlot[]>,
): UsdOwnerDayBooking {
  const slots = slotsByBooking.get(row.id) ?? [];
  // Only called for a game in dollars (see toOwnerDayBooking).
  const amountDueUsd = row.amountDue.amount;
  return {
    ...gameFields(
      row,
      slots,
      Decimal.max(bookingRemaining(amountDueUsd, row.collectedUsd), 0).plus(row.tabsRemainingUsd),
      new Decimal(0),
    ),
    currency: "USD",
    priceUsd: row.price.amount,
    amountDueUsd,
    remaining: bookingRemaining(amountDueUsd, row.collectedUsd),
  };
}

function gameFields(row: DayBookingRow, slots: OwnerSlot[], owedUsd: Decimal, owedLbp: Decimal): OwnerDayGame {
  const allocated = slots.reduce((sum, slot) => sum.plus(slot.paid), new Decimal(0));
  return {
    id: row.id,
    status: row.status,
    pitchId: row.pitchId,
    pitchName: row.pitchName,
    start: row.start,
    end: row.end,
    collectedUsd: row.collectedUsd,
    tabsRemainingUsd: row.tabsRemainingUsd,
    owedUsd,
    owedLbp,
    collectionMode: row.collectionMode,
    pitchDefaultPlayerCount: row.pitchDefaultPlayerCount,
    slots,
    unassignedUsd:
      row.collectionMode === "PER_PLAYER" && row.amountDue.currency === "USD"
        ? unassignedUsd(row.collectedUsd, allocated)
        : new Decimal(0),
    requesterPersonId: row.requesterPersonId,
    requesterName: row.requesterName,
    requesterPhone: row.requesterPhone,
  };
}
