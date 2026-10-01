import Decimal from "decimal.js";

/**
 * Today's free-slot strip (UX-01 §3, amended). Pure: no database, no clock.
 * Free = a slot the availability engine produced, starting after `now`, and not
 * overlapped by an APPROVED booking. PENDING never removes a slot; it only adds a count.
 */

export type FreeStripSlot = {
  pitchId: string;
  pitchName: string;
  /** The pitch's default price, to decide whether a chip shows its own price. */
  defaultPriceUsd: string;
  startIso: string;
  endIso: string;
  startLocal: string;
  endLocal: string;
  priceUsd: string;
};

export type ApprovedRange = { pitchId: string; start: Date; end: Date };

export type FreeChip = {
  startIso: string;
  endIso: string;
  startLocal: string;
  endLocal: string;
  /** Null when it equals the pitch default. */
  priceUsd: string | null;
  /** Full price, for the booking sheet. */
  fullPriceUsd: string;
  pending: number;
};

export type FreeStripPitch = {
  pitchId: string;
  pitchName: string;
  chips: FreeChip[];
};

/** Key for `pendingCounts`: pitch id + slot start instant. */
export function pendingKey(pitchId: string, start: Date | string): string {
  const iso = typeof start === "string" ? start : start.toISOString();
  return `${pitchId}|${iso}`;
}

export function buildFreeStrip(
  slots: FreeStripSlot[],
  approvedRanges: ApprovedRange[],
  pendingCounts: ReadonlyMap<string, number>,
  now: Date,
): FreeStripPitch[] {
  const byPitch = new Map<string, FreeStripPitch>();

  for (const slot of slots) {
    const start = new Date(slot.startIso).getTime();
    const end = new Date(slot.endIso).getTime();
    if (start <= now.getTime()) continue;
    const taken = approvedRanges.some(
      (range) =>
        range.pitchId === slot.pitchId &&
        range.start.getTime() < end &&
        range.end.getTime() > start,
    );
    if (taken) continue;

    let pitch = byPitch.get(slot.pitchId);
    if (!pitch) {
      pitch = { pitchId: slot.pitchId, pitchName: slot.pitchName, chips: [] };
      byPitch.set(slot.pitchId, pitch);
    }
    pitch.chips.push({
      startIso: slot.startIso,
      endIso: slot.endIso,
      startLocal: slot.startLocal,
      endLocal: slot.endLocal,
      priceUsd: new Decimal(slot.priceUsd).equals(slot.defaultPriceUsd)
        ? null
        : slot.priceUsd,
      fullPriceUsd: slot.priceUsd,
      pending: pendingCounts.get(pendingKey(slot.pitchId, slot.startIso)) ?? 0,
    });
  }

  const pitches = [...byPitch.values()];
  for (const pitch of pitches) {
    pitch.chips.sort(
      (a, b) => new Date(a.startIso).getTime() - new Date(b.startIso).getTime(),
    );
  }
  return pitches;
}
