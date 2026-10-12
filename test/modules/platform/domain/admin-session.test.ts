import { describe, expect, it } from "@jest/globals";
import {
  ADMIN_SESSION_ABSOLUTE_MS,
  ADMIN_SESSION_IDLE_MS,
  isSessionAlive,
  shouldTouch,
} from "@/modules/platform/domain/admin-session";

/** Written, not run. 8 hours at most, 30 minutes idle, and a touch at most once a minute. */
const T0 = new Date("2026-10-15T08:00:00.000Z");
const after = (base: Date, ms: number) => new Date(base.getTime() + ms);
const MIN = 60_000;

function session(overrides: Partial<{ createdAt: Date; lastSeenAt: Date; expiresAt: Date }> = {}) {
  return { createdAt: T0, lastSeenAt: T0, expiresAt: after(T0, ADMIN_SESSION_ABSOLUTE_MS), ...overrides };
}

describe("isSessionAlive", () => {
  it("is alive while it is used within 30 minutes and under 8 hours old", () => {
    expect(ADMIN_SESSION_IDLE_MS).toBe(30 * MIN);
    expect(ADMIN_SESSION_ABSOLUTE_MS).toBe(8 * 60 * MIN);
    expect(isSessionAlive(session(), after(T0, 29 * MIN))).toBe(true);
    expect(isSessionAlive(session({ lastSeenAt: after(T0, 6 * 60 * MIN) }), after(T0, 6 * 60 * MIN + 29 * MIN))).toBe(true);
  });

  it("expires at 30 minutes idle", () => {
    expect(isSessionAlive(session(), after(T0, 30 * MIN))).toBe(false);
    expect(isSessionAlive(session(), after(T0, 31 * MIN))).toBe(false);
  });

  it("expires 8 hours after creation however recently it was used", () => {
    const busy = session({ lastSeenAt: after(T0, 8 * 60 * MIN - MIN) });
    expect(isSessionAlive(busy, after(T0, 8 * 60 * MIN - 30_000))).toBe(true);
    expect(isSessionAlive(busy, after(T0, 8 * 60 * MIN))).toBe(false);
    expect(isSessionAlive(busy, after(T0, 9 * 60 * MIN))).toBe(false);
  });

  it("expires at the stored expiry even when both clocks would allow it", () => {
    expect(isSessionAlive(session({ expiresAt: after(T0, 10 * MIN) }), after(T0, 10 * MIN))).toBe(false);
    expect(isSessionAlive(session({ expiresAt: after(T0, 10 * MIN) }), after(T0, 9 * MIN))).toBe(true);
  });
});

describe("shouldTouch", () => {
  it("is false at 59 seconds and true at 61 seconds (and exactly 60)", () => {
    expect(shouldTouch(T0, after(T0, 59_000))).toBe(false);
    expect(shouldTouch(T0, after(T0, 60_000))).toBe(true);
    expect(shouldTouch(T0, after(T0, 61_000))).toBe(true);
  });
});
