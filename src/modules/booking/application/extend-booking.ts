import Decimal from "decimal.js";
import { DomainError } from "@/lib/errors";
import db from "@/lib/db";
import { logger } from "@/lib/logger";
import { safeTenantId } from "@/lib/tenant-context";
import { rethrowUnexpected } from "@/lib/use-case-error";
import { getCurrentMembership } from "@/modules/access/application/get-current-membership";
import { BOOKINGS_ADJUST_DUE, BOOKINGS_EXTEND, can } from "@/modules/access/domain/can";
import {
  rejectOverlappingPending,
  type AutoRejectedPerson,
} from "@/modules/booking/application/reject-overlapping-pending";
import { collectedOn } from "@/modules/booking/application/game-collected";
import { appendDueChange, writeDueIfChanged } from "@/modules/booking/application/write-due-change";
import { isExclusionViolation } from "@/modules/booking/domain/exclusion";
import { extensionNote, extensionPlan } from "@/modules/booking/domain/extension-plan";
import {
  findBookingForDecision,
  findBookingForUpdate,
  listApprovedRanges,
  lockPitchForUpdate,
  setBookingEndAndPrice,
} from "@/modules/booking/infrastructure/bookings";
import { findPitchById } from "@/modules/venue/infrastructure/pitches";
import { parseScheduleConfig } from "@/modules/venue/domain/schedule-config";

const TIME_ZONE = "Asia/Beirut";
/** The most a member may type as the added price: $100,000, or its worth in pounds (about 10 billion). */
const MAX_ADDED_PRICE_USD = new Decimal(100_000);
const MAX_ADDED_PRICE_LBP = new Decimal(10_000_000_000);

export type ExtendedBooking = {
  bookingId: string;
  start: Date;
  oldEnd: Date;
  newEnd: Date;
  /** The game's currency; `addedPrice` and `amountDue` (the new due) are in it (DR-007 slice 8). */
  currency: "USD" | "LBP";
  addedPrice: Decimal;
  amountDue: Decimal;
  /** Pending requests that fell inside the added time: declined and kept as interests. */
  declined: AutoRejectedPerson[];
};

/**
 * Add 30 minutes to a confirmed game that has not ended (repeatable, 180 minutes in total).
 *
 * Authorize (bookings.extend) before the transaction. Then the lock order of cancel: the pitch,
 * then the booking row; everything is re-checked after the locks. `expectedEndsAt` is the end the
 * owner saw: if the booking's end has moved since (a double tap, another device) the call is
 * refused with booking.changed, so two taps add 30 minutes once, not 60.
 *
 * Refused for PENDING / REJECTED / CANCELLED / NO_SHOW / ended / per-player bookings, when an
 * APPROVED game on the pitch starts before the new end, when the new end leaves the opening
 * window, or past 180 minutes. Pending requests inside the added time are declined and recorded
 * as interests, exactly as approval does. The price rises proportionally, in the game's currency and
 * rounded to its money unit (the price and the due, through writeDueIfChanged with reason EXTENSION);
 * only a member with bookings.adjust_due may send a different amount, in the field of that currency
 * (`addedPriceUsd` or `addedPriceLbp`). Collected money is untouched. The exclusion constraint is the
 * backstop: 23P01 becomes booking.extend_next_taken.
 */
export async function extendBooking(input: {
  bookingId: string;
  expectedEndsAt: Date;
  addedPriceUsd?: Decimal;
  addedPriceLbp?: Decimal;
}): Promise<ExtendedBooking> {
  const membership = await getCurrentMembership();
  if (!membership || !can(membership, BOOKINGS_EXTEND)) {
    throw new DomainError("access.not_allowed");
  }
  if (
    input.addedPriceUsd !== undefined &&
    (!input.addedPriceUsd.isFinite() ||
      input.addedPriceUsd.lt(0) ||
      input.addedPriceUsd.gt(MAX_ADDED_PRICE_USD))
  ) {
    throw new DomainError("form.invalid");
  }
  if (
    input.addedPriceLbp !== undefined &&
    (!input.addedPriceLbp.isFinite() ||
      input.addedPriceLbp.lt(0) ||
      input.addedPriceLbp.gt(MAX_ADDED_PRICE_LBP) ||
      !input.addedPriceLbp.isInteger())
  ) {
    throw new DomainError("form.invalid");
  }

  const now = new Date();
  try {
    const extended = await db.$transaction(async (tx) => {
      const loaded = await findBookingForDecision(tx, input.bookingId);
      if (!loaded) {
        throw new DomainError("booking.not_found");
      }
      await lockPitchForUpdate(tx, loaded.pitchId);
      const booking = await findBookingForUpdate(tx, input.bookingId);
      if (!booking) {
        throw new DomainError("booking.not_found");
      }
      if (booking.end.getTime() !== input.expectedEndsAt.getTime()) {
        throw new DomainError("booking.changed");
      }

      const pitch = await findPitchById(tx, booking.pitchId);
      if (!pitch) {
        throw new DomainError("booking.pitch_not_found");
      }
      const approved = await listApprovedRanges(tx, booking.pitchId, now);
      const following = approved
        .filter((range) => range.start.getTime() >= booking.end.getTime())
        .sort((a, b) => a.start.getTime() - b.start.getTime())[0];

      const plan = extensionPlan(
        booking,
        parseScheduleConfig(pitch.scheduleConfig),
        now,
        following ? following.start : null,
        TIME_ZONE,
      );
      if (!plan.allowed) {
        throw new DomainError(`booking.extend_${refusalKey(plan.reason)}`);
      }

      const { currency } = booking.due;
      const typed = currency === "LBP" ? input.addedPriceLbp : input.addedPriceUsd;
      if ((currency === "LBP" ? input.addedPriceUsd : input.addedPriceLbp) !== undefined) {
        throw new DomainError("form.invalid");
      }
      const added = typed ?? plan.addedPrice;
      if (!added.equals(plan.addedPrice) && !can(membership, BOOKINGS_ADJUST_DUE)) {
        throw new DomainError("access.not_allowed");
      }

      // The added time is claimed like an approval: pending requests inside it lose.
      const declined = await rejectOverlappingPending(tx, {
        pitchId: booking.pitchId,
        start: booking.end,
        end: plan.newEnd,
      });

      await setBookingEndAndPrice(tx, {
        bookingId: booking.id,
        newEnd: plan.newEnd,
        price: { currency, amount: booking.price.amount.plus(added) },
      });
      const note = extensionNote(booking.start, booking.end, plan.newEnd, TIME_ZONE);
      if (added.isZero()) {
        // A free extension changes no amount, so writeDueIfChanged would log nothing. The log row
        // is also what marks the game as extended on the cards, so it is written anyway.
        await appendDueChange(tx, {
          bookingId: booking.id,
          currency,
          from: booking.due.amount,
          to: booking.due.amount,
          reason: "EXTENSION",
          note,
          actorMembershipId: membership.membershipId,
        });
      } else {
        await writeDueIfChanged(tx, {
          bookingId: booking.id,
          currency,
          from: booking.due.amount,
          to: booking.due.amount.plus(added),
          collected: await collectedOn(tx, booking),
          collectionMode: booking.collectionMode,
          reason: "EXTENSION",
          note,
          actorMembershipId: membership.membershipId,
        });
      }

      return {
        bookingId: booking.id,
        start: booking.start,
        oldEnd: booking.end,
        newEnd: plan.newEnd,
        currency,
        addedPrice: added,
        amountDue: booking.due.amount.plus(added),
        declined,
      };
    });

    logger.info(`Booking extended ${input.bookingId} declined=${extended.declined.length}`, undefined, {
      useCase: "extendBooking",
      tenantId: await safeTenantId(),
    });
    return extended;
  } catch (error) {
    if (isExclusionViolation(error)) {
      logger.error("Extend collision", error, { useCase: "extendBooking", tenantId: await safeTenantId() });
      throw new DomainError("booking.extend_next_taken");
    }
    return await rethrowUnexpected(error, "Extend booking failed", "extendBooking");
  }
}

function refusalKey(reason: string | null): string {
  switch (reason) {
    case "not_approved":
    case "ended":
    case "per_player":
    case "next_game":
    case "closing":
      return reason;
    default:
      return "max";
  }
}
