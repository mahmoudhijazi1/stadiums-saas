/**
 * The public page lists only the times a player can still ask for: a taken time is not shown, and a
 * time that already started never gets here (getDayAvailability drops it). Pure: it works on the day's
 * slots as the venue module hands them over.
 */
export type TimeSlotLike = { priceUsd: string; available: boolean };

/** The slots of one pitch that are free to request, in the order given (chronological). */
export function freeSlots<T extends TimeSlotLike>(slots: T[]): T[] {
  return slots.filter((slot) => slot.available);
}

/**
 * Keep only the pitches that have a free time, each with only its free times. Closed or full pitches
 * leave the list, so the page never shows a heading with nothing under it.
 */
export function freePitches<T extends { slots: TimeSlotLike[] }>(pitches: T[]): T[] {
  return pitches
    .map((pitch) => ({ ...pitch, slots: freeSlots(pitch.slots) }))
    .filter((pitch) => pitch.slots.length > 0);
}

/**
 * The price most of the day's free times have (the one the heading states). On a tie the price that
 * appears first, i.e. the earliest time, wins; no free time gives null. Prices stay decimal strings.
 */
export function commonPriceUsd(slots: TimeSlotLike[]): string | null {
  const counts = new Map<string, number>();
  for (const slot of slots) counts.set(slot.priceUsd, (counts.get(slot.priceUsd) ?? 0) + 1);
  let best: string | null = null;
  let bestCount = 0;
  for (const [price, count] of counts) {
    if (count > bestCount) {
      best = price;
      bestCount = count;
    }
  }
  return best;
}
