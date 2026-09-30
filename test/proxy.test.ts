/** @jest-environment node */
import { describe, expect, it } from "@jest/globals";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";

/**
 * Rolling session cookie: Server Components cannot set cookies
 * (cookies.md), so the proxy re-issues the session cookie on GET, at most once
 * a day (a day-long marker cookie).
 */
function get(cookie?: string, method = "GET") {
  const headers = new Headers({ host: "ahmad.lebstads.test" });
  if (cookie) headers.set("cookie", cookie);
  return new NextRequest("http://ahmad.lebstads.test/owner/today", { method, headers });
}

function setCookies(response: Response): string[] {
  return response.headers.getSetCookie();
}

describe("proxy session cookie refresh", () => {
  it("re-issues the session cookie for 30 days with the same value and flags, plus the marker", () => {
    const cookies = setCookies(proxy(get("stadium_session=tok_123")));
    const session = cookies.find((line) => line.startsWith("stadium_session="));
    expect(session).toBeDefined();
    expect(session).toContain("stadium_session=tok_123;");
    expect(session).toMatch(/Max-Age=2592000/i);
    expect(session).toMatch(/HttpOnly/i);
    expect(session).toMatch(/SameSite=lax/i);
    expect(session).toMatch(/Path=\//i);
    expect(session).not.toMatch(/Domain=/i);
    const marker = cookies.find((line) => line.startsWith("stadium_session_renewed="));
    expect(marker).toMatch(/Max-Age=86400/i);
  });

  it("does nothing while the day-long marker is present", () => {
    expect(setCookies(proxy(get("stadium_session=tok_123; stadium_session_renewed=1")))).toEqual([]);
  });

  it("does nothing without a session cookie, or on POST (login and logout write the cookie themselves)", () => {
    expect(setCookies(proxy(get()))).toEqual([]);
    expect(setCookies(proxy(get("stadium_session=tok_123", "POST")))).toEqual([]);
  });
});
