/**
 * Rolling session: 30 days from the last use, renewed at most once a day so a
 * busy owner does not write the Session row on every request.
 */
export const SESSION_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;
export const SESSION_RENEW_INTERVAL_MS = 24 * 60 * 60 * 1000;

/** New expiry when a live session was last renewed a day ago or more; otherwise null. */
export function renewedSessionExpiry(expiresAt: Date, now: Date): Date | null {
  if (expiresAt.getTime() <= now.getTime()) return null;
  const renewBy = now.getTime() + SESSION_LIFETIME_MS - SESSION_RENEW_INTERVAL_MS;
  if (expiresAt.getTime() > renewBy) return null;
  return new Date(now.getTime() + SESSION_LIFETIME_MS);
}
