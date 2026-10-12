/** Items can be put on a game from this many minutes before its start. */
export const ITEMS_OPEN_MINUTES_BEFORE_START = 60;

/**
 * May items be added to this booking now? Only a confirmed (APPROVED) game, from 60 minutes before
 * its start, and it stays open during and after the game. PENDING, CANCELLED, NO_SHOW and REJECTED
 * never. `start` and `now` are UTC instants, so there is no time-zone arithmetic. Lives in the
 * booking module (not shop) because the rule is about a booking's status and start, and shop
 * does not import booking.
 */
export function mayAddItemsToBooking({ status, start, now }: { status: string; start: Date; now: Date }): boolean {
  if (status !== "APPROVED") return false;
  return now.getTime() >= start.getTime() - ITEMS_OPEN_MINUTES_BEFORE_START * 60_000;
}
