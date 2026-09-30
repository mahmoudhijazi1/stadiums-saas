/**
 * Session cookie name and flags, shared by the Server Actions that log in
 * (session-cookie.ts) and the proxy that renews it. No next/headers here, so
 * the proxy can import it.
 * No `domain` → host-only, so ahmad's cookie is never sent to sami.
 */
export const SESSION_COOKIE = "stadium_session";
/** Present for a day after the proxy renewed the session cookie. */
export const SESSION_RENEWED_COOKIE = "stadium_session_renewed";
export const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;
export const SESSION_RENEWED_MAX_AGE_SECONDS = 24 * 60 * 60;

export function sessionCookieFlags() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    secure: process.env.NODE_ENV === "production",
  };
}
