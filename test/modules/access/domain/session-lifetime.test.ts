import { describe, expect, it } from "@jest/globals";
import {
  SESSION_LIFETIME_MS,
  renewedSessionExpiry,
} from "@/modules/access/domain/session-lifetime";

const DAY = 24 * 60 * 60 * 1000;
const now = new Date("2026-10-01T12:00:00.000Z");
const at = (ms: number) => new Date(now.getTime() + ms);

/** Rolling 30-day session, extended at most once per day on use. */
describe("renewedSessionExpiry", () => {
  it("lifetime is 30 days", () => {
    expect(SESSION_LIFETIME_MS).toBe(30 * DAY);
  });

  it("renews to now + 30 days once the last renewal is a day old or more", () => {
    expect(renewedSessionExpiry(at(29 * DAY), now)).toEqual(at(30 * DAY));
    expect(renewedSessionExpiry(at(DAY), now)).toEqual(at(30 * DAY));
  });

  it("does nothing within a day of the last renewal", () => {
    expect(renewedSessionExpiry(at(30 * DAY), now)).toBeNull();
    expect(renewedSessionExpiry(at(29 * DAY + 1), now)).toBeNull();
  });

  it("never revives an expired session", () => {
    expect(renewedSessionExpiry(now, now)).toBeNull();
    expect(renewedSessionExpiry(at(-1), now)).toBeNull();
  });
});
