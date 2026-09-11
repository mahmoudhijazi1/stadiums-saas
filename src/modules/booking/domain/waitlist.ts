import { overlaps, type UtcRange } from "@/modules/booking/domain/offered-slot";

export type WaitlistWindowLike = { pitchId: string } & UtcRange;

/**
 * Waitlist shows this window only if it has not ended and no APPROVED range
 * occupies it (BR-29). Caller passes APPROVED only — CANCELLED is not occupied.
 */
export function isWaitlistWindowOpen(input: {
  window: WaitlistWindowLike;
  occupied: WaitlistWindowLike[];
  now: Date;
}): boolean {
  if (input.window.end.getTime() <= input.now.getTime()) {
    return false;
  }
  return !input.occupied.some(
    (row) =>
      row.pitchId === input.window.pitchId && overlaps(row, input.window),
  );
}
