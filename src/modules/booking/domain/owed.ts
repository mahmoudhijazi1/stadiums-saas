import Decimal from "decimal.js";
import { classifyDue, type DueStatus } from "@/modules/booking/domain/classify-due";
import {
  personOwedOnBooking,
  type CollectionModeName,
} from "@/modules/booking/domain/person-owed";

/** One participant of a booking that has money still due, already loaded. Not a Prisma type. */
export type OwedParticipation = {
  bookingId: string;
  status: DueStatus;
  start: Date;
  end: Date;
  collectionMode: CollectionModeName;
  pitchName: string;
  /** Null for an unnamed per-player slot. */
  personId: string | null;
  personName: string | null;
  personPhone: string | null;
  isRequester: boolean;
  bookingRemainingUsd: Decimal;
  participantRemainingUsd: Decimal;
};

export type OwedDebt = {
  bookingId: string;
  status: DueStatus;
  start: Date;
  end: Date;
  pitchName: string;
  owedUsd: Decimal;
};

export type OwedGroup = {
  /** Null is the one "Unnamed players" group. */
  personId: string | null;
  name: string | null;
  phone: string | null;
  totalUsd: Decimal;
  /** Distinct games. */
  games: number;
  /** Newest first. */
  debts: OwedDebt[];
};

export type OwedSummary = {
  totalUsd: Decimal;
  /** Distinct games with money owed. */
  games: number;
  /** Newest debt first. */
  groups: OwedGroup[];
};

/**
 * Who owes what, from the existing owed rules: `classifyDue` says "owed" (an ended game, a
 * no-show or a cancelled fee), and `personOwedOnBooking` says how much of it is this
 * person's (the requester on a whole-game booking, each slot on a per-player one). Slots
 * with no person share one group. Groups are ordered by their newest debt.
 */
export function summarizeOwed(rows: readonly OwedParticipation[], now: Date): OwedSummary {
  const groups = new Map<string, OwedGroup>();
  const games = new Set<string>();
  let totalUsd = new Decimal(0);

  for (const row of rows) {
    const owed = Decimal.max(
      personOwedOnBooking({
        collectionMode: row.collectionMode,
        isRequester: row.isRequester,
        bookingRemainingUsd: row.bookingRemainingUsd,
        participantRemainingUsd: row.participantRemainingUsd,
      }),
      0,
    );
    if (
      classifyDue({ status: row.status, start: row.start, end: row.end, remaining: owed, now }) !== "owed"
    ) {
      continue;
    }

    totalUsd = totalUsd.plus(owed);
    games.add(row.bookingId);
    const key = row.personId ?? "";
    const group =
      groups.get(key) ??
      ({
        personId: row.personId,
        name: row.personName,
        phone: row.personPhone,
        totalUsd: new Decimal(0),
        games: 0,
        debts: [],
      } satisfies OwedGroup);
    group.totalUsd = group.totalUsd.plus(owed);
    group.debts.push({
      bookingId: row.bookingId,
      status: row.status,
      start: row.start,
      end: row.end,
      pitchName: row.pitchName,
      owedUsd: owed,
    });
    groups.set(key, group);
  }

  const ordered = [...groups.values()].map((group) => {
    const debts = [...group.debts].sort(
      (a, b) => b.start.getTime() - a.start.getTime() || (a.bookingId < b.bookingId ? 1 : -1),
    );
    return { ...group, debts, games: new Set(debts.map((debt) => debt.bookingId)).size };
  });
  ordered.sort((a, b) => {
    const diff = b.debts[0]!.start.getTime() - a.debts[0]!.start.getTime();
    if (diff !== 0) return diff;
    // Same newest debt: named people first, the unnamed group last.
    if (a.name === null) return b.name === null ? 0 : 1;
    if (b.name === null) return -1;
    return a.name.localeCompare(b.name);
  });
  return { totalUsd, games: games.size, groups: ordered };
}
