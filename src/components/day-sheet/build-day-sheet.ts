/**
 * Pure row builder for the one-column day sheet. Minutes are from local midnight.
 * No database, no clock: `nowMin` is null when the day is not today.
 */

export type SheetPitch = {
  id: string;
  name: string;
  gameMin: number;
  priceUsd: number;
  /** Null when the pitch is closed all day. */
  openStartMin: number | null;
  openEndMin: number | null;
  /** Slots starting inside a rule's window take its price instead of the default. */
  priceRules?: { startMin: number; endMin: number; priceUsd: number }[];
};

export type SheetBooking = {
  id: string;
  pitchId: string;
  startMin: number;
  durationMin: number;
  name: string;
  priceUsd: number;
  paidUsd: number;
};

export type SheetRow =
  | { kind: "booking"; startMin: number; booking: SheetBooking }
  | {
      kind: "free";
      startMin: number;
      durationMin: number;
      priceUsd: number;
      /** Pending requests on this slot. */
      pending: number;
    }
  | { kind: "now"; startMin: number };

export function buildDaySheet(
  pitch: SheetPitch,
  bookings: SheetBooking[],
  pendingByStart: ReadonlyMap<number, number>,
  nowMin: number | null,
): SheetRow[] {
  const mine = bookings.filter((b) => b.pitchId === pitch.id);
  const rows: SheetRow[] = mine.map((booking) => ({
    kind: "booking",
    startMin: booking.startMin,
    booking,
  }));

  if (pitch.openStartMin !== null && pitch.openEndMin !== null) {
    for (
      let start = pitch.openStartMin;
      start + pitch.gameMin <= pitch.openEndMin;
      start += pitch.gameMin
    ) {
      const end = start + pitch.gameMin;
      // Past free slots are hidden; past bookings stay.
      if (nowMin !== null && start <= nowMin) continue;
      // Any booking that overlaps the slot takes it, aligned or not.
      const taken = mine.some((b) => b.startMin < end && b.startMin + b.durationMin > start);
      if (taken) continue;
      rows.push({
        kind: "free",
        startMin: start,
        durationMin: pitch.gameMin,
        priceUsd:
          pitch.priceRules?.find((r) => start >= r.startMin && start < r.endMin)?.priceUsd ??
          pitch.priceUsd,
        pending: pendingByStart.get(start) ?? 0,
      });
    }
  }

  rows.sort((a, b) => a.startMin - b.startMin);
  if (nowMin !== null) {
    const at = rows.findIndex((row) => row.startMin > nowMin);
    const divider: SheetRow = { kind: "now", startMin: nowMin };
    if (at === -1) rows.push(divider);
    else rows.splice(at, 0, divider);
  }
  return rows;
}

/** Free slots still offered on this pitch (for the switcher count). */
export function freeCount(rows: SheetRow[]): number {
  return rows.filter((row) => row.kind === "free").length;
}
