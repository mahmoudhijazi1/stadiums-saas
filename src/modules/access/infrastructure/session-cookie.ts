import { cookies } from "next/headers";

/**
 * HTTP-only session cookie (DR-003 §4).
 * Next 16: `cookies` is async; `.set`/`.delete` only in a Server Function
 * (node_modules/next/dist/docs/01-app/03-api-reference/04-functions/cookies.md).
 * No `domain` → host-only so ahmad's cookie is not sent to sami.
 */
export const SESSION_COOKIE = "stadium_session";
export const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

export async function readSessionCookie(): Promise<string | undefined> {
  return (await cookies()).get(SESSION_COOKIE)?.value;
}

export async function writeSessionCookie(sessionId: string, expires: Date) {
  const store = await cookies();
  store.set({
    name: SESSION_COOKIE,
    value: sessionId,
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_MAX_AGE_SECONDS,
    expires,
  });
}

export async function clearSessionCookie() {
  (await cookies()).delete(SESSION_COOKIE);
}
