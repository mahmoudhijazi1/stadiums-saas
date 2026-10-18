/**
 * The public page lists only the times a player can still ask for: a taken time is not shown, and a
 * time that already started never gets here (getDayAvailability drops it). Pure: it works on the day's
 * slots as the venue module hands them over.
 */
import type { PriceView } from "@/modules/venue/domain/availability";

/** `price` is in the stadium's currency (DR-007); null when the pitch has no price in it. */
export type TimeSlotLike = { price: PriceView | null; available: boolean };

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
 * appears first, i.e. the earliest time, wins; no free time (or no priced one) gives null. Amounts
 * stay strings; a slot with no price in the stadium's currency is not counted.
 */
export function commonPrice(slots: TimeSlotLike[]): PriceView | null {
  const counts = new Map<string, { price: PriceView; count: number }>();
  for (const slot of slots) {
    if (!slot.price) continue;
    const key = `${slot.price.currency} ${slot.price.amount}`;
    const seen = counts.get(key);
    counts.set(key, { price: slot.price, count: (seen?.count ?? 0) + 1 });
  }
  let best: PriceView | null = null;
  let bestCount = 0;
  for (const { price, count } of counts.values()) {
    if (count > bestCount) {
      best = price;
      bestCount = count;
    }
  }
  return best;
}
