import type { BookingTone } from "@/components/day-grid/booking-block";

/** Hard-coded fake data for the Today grid mockup. No database, no use cases. */
export type FakePitch = {
  id: string;
  name: string;
  gameMin: number;
  priceUsd: number;
  openStartMin: number;
  openEndMin: number;
};

export type FakeBooking = {
  id: string;
  pitchId: string;
  startMin: number;
  durationMin: number;
  name: string;
  priceUsd: number;
  paidUsd: number;
};

export type FreeSlot = { pitchId: string; startMin: number; durationMin: number };

const h = (hour: number, minute = 0) => hour * 60 + minute;

const ALL_PITCHES: FakePitch[] = [
  { id: "a1", name: "Pitch A1", gameMin: 60, priceUsd: 30, openStartMin: h(16), openEndMin: h(22) },
  { id: "a2", name: "Pitch A2", gameMin: 90, priceUsd: 35, openStartMin: h(16), openEndMin: h(22) },
  // Closes an hour early, so the grid shows closed time next to free time.
  { id: "a3", name: "Pitch A3", gameMin: 60, priceUsd: 30, openStartMin: h(16), openEndMin: h(21) },
  { id: "a4", name: "Pitch A4", gameMin: 60, priceUsd: 30, openStartMin: h(16), openEndMin: h(22) },
  { id: "a5", name: "Pitch A5", gameMin: 60, priceUsd: 30, openStartMin: h(16), openEndMin: h(22) },
];

const ALL_BOOKINGS: FakeBooking[] = [
  { id: "b1", pitchId: "a1", startMin: h(16), durationMin: 60, name: "Mahmoud Hijazi", priceUsd: 30, paidUsd: 0 },
  { id: "b2", pitchId: "a3", startMin: h(16), durationMin: 60, name: "Karim Haddad", priceUsd: 30, paidUsd: 30 },
  { id: "b3", pitchId: "a3", startMin: h(17), durationMin: 60, name: "Rami Nasser", priceUsd: 30, paidUsd: 0 },
];

export function fakeDay(pitchCount: number) {
  const pitches = ALL_PITCHES.slice(0, Math.max(2, Math.min(5, pitchCount)));
  const ids = new Set(pitches.map((p) => p.id));
  const bookings = ALL_BOOKINGS.filter((b) => ids.has(b.pitchId));
  // With three or more pitches the mockup is "now" on the day, so paid and owed can exist.
  const defaultNow = pitches.length >= 3 ? h(18, 45) : null;
  return { pitches, bookings, defaultNow };
}

/** Paid when settled, owed when played and unpaid, expected while still to be played. */
export function bookingTone(b: FakeBooking, nowMin: number | null): BookingTone {
  if (b.paidUsd >= b.priceUsd) return "paid";
  if (nowMin !== null && b.startMin + b.durationMin <= nowMin) return "owed";
  return "expected";
}

/** Offered slots not taken by a booking and not started yet. */
export function freeSlots(
  pitches: FakePitch[],
  bookings: FakeBooking[],
  nowMin: number | null,
): FreeSlot[] {
  const out: FreeSlot[] = [];
  for (const pitch of pitches) {
    for (
      let start = pitch.openStartMin;
      start + pitch.gameMin <= pitch.openEndMin;
      start += pitch.gameMin
    ) {
      const end = start + pitch.gameMin;
      if (nowMin !== null && start <= nowMin) continue;
      const taken = bookings.some(
        (b) => b.pitchId === pitch.id && b.startMin < end && b.startMin + b.durationMin > start,
      );
      if (!taken) out.push({ pitchId: pitch.id, startMin: start, durationMin: pitch.gameMin });
    }
  }
  return out;
}
