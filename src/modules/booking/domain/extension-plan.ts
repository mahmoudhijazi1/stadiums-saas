import Decimal from "decimal.js";
import { bookingFitsOpenHours, openWindowEnd } from "@/modules/venue/domain/availability";
import type { ScheduleConfig } from "@/modules/venue/domain/schedule-config";

/** One extension adds this much. Repeatable until the cap. */
export const EXTENSION_STEP_MINUTES = 30;
/** A booking's total length never goes past this. */
export const EXTENSION_MAX_TOTAL_MINUTES = 180;

const MINUTE_MS = 60_000;

export type ExtensionRefusal =
  | "not_approved"
  | "ended"
  | "per_player"
  | "max_duration"
  | "next_game"
  | "closing";

export type ExtensionPlan = {
  allowed: boolean;
  reason: ExtensionRefusal | null;
  /** end + 30 minutes, whether or not it is allowed (the UI shows what it would be). */
  newEnd: Date;
  /** The suggested added price: the agreed price per minute x 30, half up to cents. */
  addedPriceUsd: Decimal;
  /** For the message: when the next game starts (next_game) or when the pitch closes (closing). */
  limit: Date | null;
};

export type ExtensibleBooking = {
  status: string;
  collectionMode: "WHOLE" | "PER_PLAYER";
  start: Date;
  end: Date;
  priceUsd: Decimal;
};

/** Proportional to the agreed price: priceUsd / current minutes x 30, rounded half up to cents. */
export function addedPriceForExtension(priceUsd: Decimal, start: Date, end: Date): Decimal {
  const minutes = (end.getTime() - start.getTime()) / MINUTE_MS;
  if (minutes <= 0) return new Decimal(0);
  return priceUsd.div(minutes).times(EXTENSION_STEP_MINUTES).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

/**
 * May this booking get 30 more minutes, and for how much? Pure: the caller reads the booking, the
 * pitch hours and the start of the next APPROVED game on the pitch (the earliest one that starts
 * at or after this booking's end; null if none). Checked in this order, first refusal wins:
 * not APPROVED, already ended, per-player, 180-minute cap, next game too close, closing time.
 */
export function extensionPlan(
  booking: ExtensibleBooking,
  pitchConfig: ScheduleConfig,
  now: Date,
  nextApprovedStart: Date | null,
  timeZone = "Asia/Beirut",
): ExtensionPlan {
  const newEnd = new Date(booking.end.getTime() + EXTENSION_STEP_MINUTES * MINUTE_MS);
  const addedPriceUsd = addedPriceForExtension(booking.priceUsd, booking.start, booking.end);
  const refuse = (reason: ExtensionRefusal, limit: Date | null = null): ExtensionPlan => ({
    allowed: false,
    reason,
    newEnd,
    addedPriceUsd,
    limit,
  });

  if (booking.status !== "APPROVED") return refuse("not_approved");
  if (booking.end.getTime() <= now.getTime()) return refuse("ended");
  if (booking.collectionMode === "PER_PLAYER") return refuse("per_player");
  if ((newEnd.getTime() - booking.start.getTime()) / MINUTE_MS > EXTENSION_MAX_TOTAL_MINUTES) {
    return refuse("max_duration");
  }
  if (nextApprovedStart && nextApprovedStart.getTime() < newEnd.getTime()) {
    return refuse("next_game", nextApprovedStart);
  }
  if (!bookingFitsOpenHours(pitchConfig, { start: booking.start, end: newEnd }, timeZone)) {
    return refuse("closing", openWindowEnd(pitchConfig, booking.start, timeZone));
  }
  return { allowed: true, reason: null, newEnd, addedPriceUsd, limit: null };
}

/** "18:00-19:00 → 18:00-19:30" in the stadium's clock, for the due-change note. */
export function extensionNote(start: Date, oldEnd: Date, newEnd: Date, timeZone: string): string {
  const clock = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const hm = (instant: Date) => clock.format(instant).replace(/^24:/, "00:");
  return `${hm(start)}-${hm(oldEnd)} → ${hm(start)}-${hm(newEnd)}`;
}
