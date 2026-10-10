/** Page caps for the Requests inbox (security audit S-8). Decision paths read every row. */
export const PENDING_INBOX_UPCOMING_MAX = 200;
export const PENDING_INBOX_MISSED_MAX = 50;

/**
 * How many pending requests the capped inbox leaves out, given the real totals. The inbox shows
 * the next UPCOMING_MAX upcoming and the latest MISSED_MAX missed ones.
 */
export function hiddenInboxCount(totals: { upcoming: number; missed: number }): number {
  return (
    Math.max(0, totals.upcoming - PENDING_INBOX_UPCOMING_MAX) +
    Math.max(0, totals.missed - PENDING_INBOX_MISSED_MAX)
  );
}
