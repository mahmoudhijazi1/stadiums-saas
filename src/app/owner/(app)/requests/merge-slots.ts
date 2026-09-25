import { overlaps } from "@/modules/booking/domain/offered-slot";

export type SlotWindow = {
  pitchId: string;
  start: Date;
  end: Date;
};

export function windowOverlapsPending(
  interest: SlotWindow,
  pending: SlotWindow[],
): boolean {
  return pending.some(
    (row) => row.pitchId === interest.pitchId && overlaps(interest, row),
  );
}

/** Open interest groups that do not overlap a pending request on the same pitch. */
export function interestsWithoutPending<T extends SlotWindow>(
  waitlist: T[],
  pending: SlotWindow[],
): T[] {
  return waitlist.filter((group) => !windowOverlapsPending(group, pending));
}

export function interestsForGroup<P extends { personId: string }>(
  group: SlotWindow,
  waitlist: Array<SlotWindow & { people: P[] }>,
): P[] {
  const seen = new Set<string>();
  const people: P[] = [];
  for (const item of waitlist) {
    if (item.pitchId !== group.pitchId || !overlaps(item, group)) continue;
    for (const person of item.people) {
      if (seen.has(person.personId)) continue;
      seen.add(person.personId);
      people.push(person);
    }
  }
  return people;
}

export type MergedSlotRow<R, I> =
  | { kind: "request"; request: R }
  | { kind: "interest"; interest: I };

/** Interest `createdAt` and request `requestedAt`, earliest first. */
export function mergeByTime<
  R extends { requestedAt: Date },
  I extends { createdAt: Date },
>(requests: R[], interests: I[]): MergedSlotRow<R, I>[] {
  const rows: Array<MergedSlotRow<R, I> & { at: number }> = [
    ...requests.map((request) => ({
      kind: "request" as const,
      at: request.requestedAt.getTime(),
      request,
    })),
    ...interests.map((interest) => ({
      kind: "interest" as const,
      at: interest.createdAt.getTime(),
      interest,
    })),
  ];
  rows.sort((a, b) => a.at - b.at);
  return rows.map((row) =>
    row.kind === "request"
      ? { kind: "request", request: row.request }
      : { kind: "interest", interest: row.interest },
  );
}
