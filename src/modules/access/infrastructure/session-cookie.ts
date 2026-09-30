import { cookies } from "next/headers";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  sessionCookieFlags,
} from "@/modules/access/infrastructure/session-cookie-options";

/**
 * HTTP-only session cookie (DR-003 §4).
 * Next 16: `cookies` is async; `.set`/`.delete` only in a Server Function
 * (node_modules/next/dist/docs/01-app/03-api-reference/04-functions/cookies.md).
 * The value is the raw session token; the database holds only its hash.
 * The proxy renews it on use (Server Components cannot set cookies).
 */

export async function readSessionCookie(): Promise<string | undefined> {
  return (await cookies()).get(SESSION_COOKIE)?.value;
}

export async function writeSessionCookie(token: string) {
  const store = await cookies();
  store.set({
    name: SESSION_COOKIE,
    value: token,
    ...sessionCookieFlags(),
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function clearSessionCookie() {
  (await cookies()).delete(SESSION_COOKIE);
}
