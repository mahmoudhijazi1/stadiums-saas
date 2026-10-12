/**
 * The platform admin session lifetime (DR-006): at most 8 hours from login, and 30 minutes idle.
 * Pure: the caller passes the clock.
 */
export const ADMIN_SESSION_ABSOLUTE_MS = 8 * 60 * 60 * 1000;
export const ADMIN_SESSION_IDLE_MS = 30 * 60 * 1000;
/** `lastSeenAt` is written at most once in this long, not on every request. */
export const ADMIN_SESSION_TOUCH_AFTER_MS = 60 * 1000;

/** Alive until the stored expiry, 8 hours after creation, or 30 minutes without use, whichever is first. */
export function isSessionAlive(
  session: { createdAt: Date; lastSeenAt: Date; expiresAt: Date },
  now: Date,
): boolean {
  const time = now.getTime();
  return (
    time < session.expiresAt.getTime() &&
    time < session.createdAt.getTime() + ADMIN_SESSION_ABSOLUTE_MS &&
    time - session.lastSeenAt.getTime() < ADMIN_SESSION_IDLE_MS
  );
}

/** True once at least a minute has passed since the session was last marked seen. */
export function shouldTouch(lastSeenAt: Date, now: Date): boolean {
  return now.getTime() - lastSeenAt.getTime() >= ADMIN_SESSION_TOUCH_AFTER_MS;
}
