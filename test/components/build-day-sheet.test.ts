import { describe, expect, it } from "@jest/globals";
import {
  buildDaySheet,
  freeCount,
  type SheetBooking,
  type SheetPitch,
} from "@/components/day-sheet/build-day-sheet";

const h = (hour: number, minute = 0) => hour * 60 + minute;
const pitch: SheetPitch = {
  id: "a1",
  name: "Pitch A1",
  gameMin: 60,
  priceUsd: 30,
  openStartMin: h(16),
  openEndMin: h(22),
  priceRules: [{ startMin: h(21), endMin: h(22), priceUsd: 40 }],
};
const booking = (id: string, startMin: number, durationMin = 60): SheetBooking => ({
  id,
  pitchId: "a1",
  startMin,
  durationMin,
  name: id,
  priceUsd: 30,
  paidUsd: 0,
});
const summary = (rows: ReturnType<typeof buildDaySheet>) =>
  rows.map((r) => `${r.kind}@${Math.floor(r.startMin / 60)}:${String(r.startMin % 60).padStart(2, "0")}`);

describe("buildDaySheet", () => {
  it("lists every slot in time order on a future day (no now)", () => {
    const rows = buildDaySheet(pitch, [booking("b", h(17))], new Map(), null);
    expect(summary(rows)).toEqual([
      "free@16:00", "booking@17:00", "free@18:00", "free@19:00", "free@20:00", "free@21:00",
    ]);
  });

  it("hides past free slots, keeps past bookings, and puts Now between past and upcoming", () => {
    const rows = buildDaySheet(pitch, [booking("a", h(17)), booking("b", h(19))], new Map(), h(18, 45));
    expect(summary(rows)).toEqual([
      "booking@17:00", "now@18:45", "booking@19:00", "free@20:00", "free@21:00",
    ]);
  });

  it("shows the price of a rule slot and the pending count", () => {
    const rows = buildDaySheet(pitch, [], new Map([[h(20), 2]]), h(19, 30));
    const free = rows.filter((r) => r.kind === "free");
    expect(free.map((r) => (r.kind === "free" ? [r.priceUsd, r.pending] : []))).toEqual([
      [30, 2],
      [40, 0],
    ]);
  });

  it("keeps a booking that does not align to the slots at its own time and drops the slots it covers", () => {
    const rows = buildDaySheet(pitch, [booking("odd", h(17, 30))], new Map(), null);
    expect(summary(rows)).toEqual([
      "free@16:00", "booking@17:30", "free@19:00", "free@20:00", "free@21:00",
    ]);
  });

  it("a closed pitch has no free rows, only its bookings", () => {
    const closed = { ...pitch, openStartMin: null, openEndMin: null };
    expect(buildDaySheet(closed, [], new Map(), null)).toEqual([]);
  });

  it("counts free rows for the switcher", () => {
    expect(freeCount(buildDaySheet(pitch, [booking("b", h(17))], new Map(), h(18, 45)))).toBe(3);
  });
});
