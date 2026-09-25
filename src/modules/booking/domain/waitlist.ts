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

/**
 * People already on an open window, earliest interest first.
 * The caller passes groups from `listOpenWaitlist` — this does not decide "open".
 * The person who cancelled is left out.
 */
export function peopleWaitingOn<T extends { personId: string }>(
  groups: Array<{ pitchId: string; start: Date; end: Date; people: T[] }>,
  window: { pitchId: string; start: Date; end: Date },
  excludePersonId: string,
): T[] {
  const group = groups.find(
    (row) =>
      row.pitchId === window.pitchId &&
      row.start.getTime() === window.start.getTime() &&
      row.end.getTime() === window.end.getTime(),
  );
  if (!group) return [];
  return group.people.filter((person) => person.personId !== excludePersonId);
}
