import Decimal from "decimal.js";
import { describe, expect, it } from "@jest/globals";
import {
  EXTENSION_MAX_TOTAL_MINUTES,
  addedPriceForExtension,
  extensionNote,
  extensionPlan,
  type ExtensibleBooking,
} from "@/modules/booking/domain/extension-plan";
import { CLOSED_WEEK_SCHEDULE, parseScheduleConfig, type Weekday } from "@/modules/venue/domain/schedule-config";

/**
 * Written, not run when authored. Beirut is UTC+3 on these July dates, so 18:00 local is 15:00Z.
 * 2026-07-15 is a Wednesday.
 */
const DAYS: Weekday[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

function config(hours: Partial<Record<Weekday, { start: string; end: string }[]>>) {
  const full = { ...CLOSED_WEEK_SCHEDULE.hours } as Record<Weekday, { start: string; end: string }[]>;
  for (const day of DAYS) full[day] = hours[day] ?? [];
  return parseScheduleConfig({
    slotDurationMinutes: 60,
    gapMinutes: 0,
    hours: full,
    defaultPriceUsd: "30.00",
    priceRules: [],
  });
}

const evenings = config(Object.fromEntries(DAYS.map((day) => [day, [{ start: "16:00", end: "22:00" }]])));
// Wednesday opens 22:00 to 02:00 (crosses midnight into Thursday).
const lateWednesday = config({ wed: [{ start: "22:00", end: "02:00" }] });

const at = (iso: string) => new Date(`${iso}Z`);
const BEFORE = at("2026-07-15T10:00:00");

function booking(start: string, end: string, extra: Partial<ExtensibleBooking> = {}): ExtensibleBooking {
  return {
    status: "APPROVED",
    collectionMode: "WHOLE",
    start: at(start),
    end: at(end),
    priceUsd: new Decimal("30.00"),
    ...extra,
  };
}

describe("extensionPlan", () => {
  it("allows 30 more minutes, newEnd and a proportional price", () => {
    // 18:00-19:00 local.
    const plan = extensionPlan(booking("2026-07-15T15:00:00", "2026-07-15T16:00:00"), evenings, BEFORE, null);
    expect(plan.allowed).toBe(true);
    expect(plan.reason).toBeNull();
    expect(plan.newEnd).toEqual(at("2026-07-15T16:30:00"));
    expect(plan.addedPriceUsd.toFixed(2)).toBe("15.00");
  });

  it("is allowed during the game, refused once it has ended", () => {
    const row = booking("2026-07-15T15:00:00", "2026-07-15T16:00:00");
    expect(extensionPlan(row, evenings, at("2026-07-15T15:30:00"), null).allowed).toBe(true);
    expect(extensionPlan(row, evenings, at("2026-07-15T15:59:59"), null).allowed).toBe(true);
    expect(extensionPlan(row, evenings, at("2026-07-15T16:00:00"), null)).toMatchObject({ allowed: false, reason: "ended" });
    expect(extensionPlan(row, evenings, at("2026-07-15T17:00:00"), null).reason).toBe("ended");
  });

  it.each(["PENDING", "REJECTED", "CANCELLED", "NO_SHOW"])("refuses a %s booking", (status) => {
    const plan = extensionPlan(booking("2026-07-15T15:00:00", "2026-07-15T16:00:00", { status }), evenings, BEFORE, null);
    expect(plan).toMatchObject({ allowed: false, reason: "not_approved" });
  });

  it("refuses a per-player booking", () => {
    const plan = extensionPlan(
      booking("2026-07-15T15:00:00", "2026-07-15T16:00:00", { collectionMode: "PER_PLAYER" }),
      evenings,
      BEFORE,
      null,
    );
    expect(plan).toMatchObject({ allowed: false, reason: "per_player" });
  });

  it("repeats up to 180 minutes and refuses the next step", () => {
    expect(EXTENSION_MAX_TOTAL_MINUTES).toBe(180);
    // 16:00-18:30 local (150 min) -> 180 is fine.
    const ok = extensionPlan(booking("2026-07-15T13:00:00", "2026-07-15T15:30:00"), evenings, BEFORE, null);
    expect(ok.allowed).toBe(true);
    expect(ok.newEnd).toEqual(at("2026-07-15T16:00:00"));
    // 16:00-19:00 local (180 min) -> 210 is not.
    const capped = extensionPlan(booking("2026-07-15T13:00:00", "2026-07-15T16:00:00"), evenings, BEFORE, null);
    expect(capped).toMatchObject({ allowed: false, reason: "max_duration" });
  });

  it("refuses when the next game starts inside the added time, and says when", () => {
    const row = booking("2026-07-15T15:00:00", "2026-07-15T16:00:00");
    const close = extensionPlan(row, evenings, BEFORE, at("2026-07-15T16:15:00"));
    expect(close).toMatchObject({ allowed: false, reason: "next_game", limit: at("2026-07-15T16:15:00") });
    const touching = extensionPlan(row, evenings, BEFORE, at("2026-07-15T16:30:00"));
    expect(touching.allowed).toBe(true); // [) bounds: starting exactly at the new end is fine
    expect(extensionPlan(row, evenings, BEFORE, at("2026-07-15T16:00:00")).reason).toBe("next_game");
    expect(extensionPlan(row, evenings, BEFORE, at("2026-07-15T20:00:00")).allowed).toBe(true);
  });

  it("refuses past closing time, and says when it closes", () => {
    // 21:00-22:00 local, closes 22:00.
    const plan = extensionPlan(booking("2026-07-15T18:00:00", "2026-07-15T19:00:00"), evenings, BEFORE, null);
    expect(plan).toMatchObject({ allowed: false, reason: "closing", limit: at("2026-07-15T19:00:00") });
    // 21:00-21:30 local -> 22:00 is exactly closing: allowed.
    const edge = extensionPlan(booking("2026-07-15T18:00:00", "2026-07-15T18:30:00"), evenings, BEFORE, null);
    expect(edge.allowed).toBe(true);
    expect(edge.newEnd).toEqual(at("2026-07-15T19:00:00"));
  });

  it("handles a window that crosses midnight", () => {
    // Wednesday 22:00-02:00 local. A game 00:00-01:00 Thursday local (21:00Z-22:00Z Wednesday).
    const inside = extensionPlan(booking("2026-07-15T21:00:00", "2026-07-15T22:00:00"), lateWednesday, BEFORE, null);
    expect(inside.allowed).toBe(true);
    expect(inside.newEnd).toEqual(at("2026-07-15T22:30:00"));
    // 01:00-02:00 Thursday local (22:00Z-23:00Z): closes at 02:00 local = 23:00Z.
    const closing = extensionPlan(booking("2026-07-15T22:00:00", "2026-07-15T23:00:00"), lateWednesday, BEFORE, null);
    expect(closing).toMatchObject({ allowed: false, reason: "closing", limit: at("2026-07-15T23:00:00") });
    // 01:00-01:30 -> 02:00 exactly is allowed.
    expect(extensionPlan(booking("2026-07-15T22:00:00", "2026-07-15T22:30:00"), lateWednesday, BEFORE, null).allowed).toBe(true);
    // 22:00-23:00 Wednesday local (19:00Z-20:00Z), before midnight.
    expect(extensionPlan(booking("2026-07-15T19:00:00", "2026-07-15T20:00:00"), lateWednesday, BEFORE, null).allowed).toBe(true);
  });

  it("the first refusal wins: status, then ended, then per-player, then cap, then next game, then closing", () => {
    const row = booking("2026-07-15T13:00:00", "2026-07-15T16:00:00", { status: "CANCELLED", collectionMode: "PER_PLAYER" });
    expect(extensionPlan(row, evenings, at("2026-07-15T17:00:00"), at("2026-07-15T16:10:00")).reason).toBe("not_approved");
    const approved = { ...row, status: "APPROVED" };
    expect(extensionPlan(approved, evenings, at("2026-07-15T17:00:00"), null).reason).toBe("ended");
    expect(extensionPlan(approved, evenings, BEFORE, null).reason).toBe("per_player");
    expect(extensionPlan({ ...approved, collectionMode: "WHOLE" }, evenings, BEFORE, at("2026-07-15T16:10:00")).reason).toBe("max_duration");
  });
});

describe("addedPriceForExtension", () => {
  const start = at("2026-07-15T15:00:00");
  it.each([
    ["30.00", 60, "15.00"],
    ["30.00", 90, "10.00"],
    ["25.00", 60, "12.50"],
    ["10.00", 90, "3.33"], // 3.3333 -> 3.33
    ["10.00", 70, "4.29"], // 4.2857 -> 4.29
    ["0.10", 60, "0.05"], // 0.05 exactly
    ["0.01", 60, "0.01"], // 0.005 rounds half up
    ["0.00", 60, "0.00"],
  ])("price %s for %i minutes adds %s", (price, minutes, expected) => {
    const end = new Date(start.getTime() + minutes * 60_000);
    expect(addedPriceForExtension(new Decimal(price), start, end).toFixed(2)).toBe(expected);
  });

  it("an empty or reversed range adds nothing", () => {
    expect(addedPriceForExtension(new Decimal("30"), start, start).toFixed(2)).toBe("0.00");
    expect(addedPriceForExtension(new Decimal("30"), start, new Date(start.getTime() - 1000)).toFixed(2)).toBe("0.00");
  });

  it("a second extension is priced from the new total, so the per-minute price holds", () => {
    // 60 min for $30 -> +$15 -> 90 min for $45 -> +$15 again.
    const first = addedPriceForExtension(new Decimal("30.00"), start, new Date(start.getTime() + 60 * 60_000));
    const second = addedPriceForExtension(
      new Decimal("30.00").plus(first),
      start,
      new Date(start.getTime() + 90 * 60_000),
    );
    expect(second.toFixed(2)).toBe("15.00");
  });
});

describe("extensionNote", () => {
  it("writes the old and new range in the stadium's clock", () => {
    expect(extensionNote(at("2026-07-15T15:00:00"), at("2026-07-15T16:00:00"), at("2026-07-15T16:30:00"), "Asia/Beirut")).toBe(
      "18:00-19:00 → 18:00-19:30",
    );
  });

  it("shows midnight as 00:00, not 24:00", () => {
    expect(extensionNote(at("2026-07-15T20:00:00"), at("2026-07-15T20:30:00"), at("2026-07-15T21:00:00"), "Asia/Beirut")).toBe(
      "23:00-23:30 → 23:00-00:00",
    );
  });
});
