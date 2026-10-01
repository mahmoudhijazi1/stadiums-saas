import type { BookingTone } from "@/components/day-sheet/booking-card";
import type { SheetBooking, SheetPitch } from "@/components/day-sheet/build-day-sheet";

/** Hard-coded fake data for the Today day-sheet mockup. No database, no use cases. */
const h = (hour: number, minute = 0) => hour * 60 + minute;

/** The fake "now" on the fake Thursday: 18:45. */
export const FAKE_NOW_MIN = h(18, 45);

const A1: SheetPitch = {
  id: "a1",
  name: "Pitch A1",
  gameMin: 60,
  priceUsd: 30,
  openStartMin: h(16),
  openEndMin: h(22),
  priceRules: [{ startMin: h(21), endMin: h(22), priceUsd: 40 }],
};

const A2: SheetPitch = {
  id: "a2",
  name: "Pitch A2",
  gameMin: 90,
  priceUsd: 35,
  openStartMin: h(16),
  openEndMin: h(22),
};

const BOOKINGS: SheetBooking[] = [
  // Ended at 18:00 and unpaid: owed.
  { id: "b1", pitchId: "a1", startMin: h(17), durationMin: 60, name: "Mahmoud Hijazi", priceUsd: 30, paidUsd: 0 },
  // Starts at 19:00: expected.
  { id: "b2", pitchId: "a1", startMin: h(19), durationMin: 60, name: "Sami Rizk", priceUsd: 30, paidUsd: 0 },
  { id: "b3", pitchId: "a2", startMin: h(17, 30), durationMin: 90, name: "Layla Karam", priceUsd: 35, paidUsd: 35 },
];

/** Pending requests per pitch and slot start. */
const PENDING: Record<string, Map<number, number>> = {
  a1: new Map([[h(20), 2]]),
  a2: new Map([[h(19), 1]]),
};

export function fakeDay(pitchCount: number, closed: boolean) {
  const pitches = (pitchCount >= 2 ? [A1, A2] : [A1]).map((p) =>
    closed ? { ...p, openStartMin: null, openEndMin: null } : p,
  );
  const ids = new Set(pitches.map((p) => p.id));
  return {
    pitches,
    bookings: BOOKINGS.filter((b) => ids.has(b.pitchId)),
    pending: PENDING,
  };
}

/** Paid when settled, owed when played and unpaid, expected while still to be played. */
export function bookingTone(b: SheetBooking, nowMin: number | null): BookingTone {
  if (b.paidUsd >= b.priceUsd) return "paid";
  if (nowMin !== null && b.startMin + b.durationMin <= nowMin) return "owed";
  return "expected";
}
