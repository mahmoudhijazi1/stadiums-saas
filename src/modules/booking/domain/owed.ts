import Decimal from "decimal.js";
import { classifyDue, type DueStatus } from "@/modules/booking/domain/classify-due";
import { remainingOf, type Remaining } from "@/modules/booking/domain/game-owing";
import {
  personOwedOnBooking,
  type CollectionModeName,
} from "@/modules/booking/domain/person-owed";

/**
 * One participant of a booking that has money still due, already loaded. Not a Prisma type. The
 * remaining is in the game's currency (`Remaining`): dollars under the USD names, pounds under the
 * LBP names (DR-007).
 */
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
} & Remaining;

/** An unpaid player tab on a game that is owed. */
export type OwedTab = {
  saleId: string;
  bookingId: string;
  status: DueStatus;
  start: Date;
  end: Date;
  pitchName: string;
  /** Null when the tab was opened under a typed name. */
  personId: string | null;
  name: string;
  phone: string | null;
  remainingUsd: Decimal;
};

export type OwedDebt = {
  /** "game": the booking (or the player's slot); "tab": the shop items charged to the player. */
  kind: "game" | "tab";
  bookingId: string;
  status: DueStatus;
  start: Date;
  end: Date;
  pitchName: string;
  /** What is owed, in dollars; zero on a debt in pounds. */
  owedUsd: Decimal;
  /** What is owed, in pounds (an LBP game); zero on a debt in dollars. Never converted (DR-007). */
  owedLbp: Decimal;
};

export type OwedGroup = {
  /** Null is the one "Unnamed players" group. */
  personId: string | null;
  name: string | null;
  phone: string | null;
  totalUsd: Decimal;
  totalLbp: Decimal;
  /** Distinct games. */
  games: number;
  /** Newest first. */
  debts: OwedDebt[];
};

export type OwedSummary = {
  totalUsd: Decimal;
  /** The same total in pounds: LBP games are never added to dollars (DR-007 decision 11). */
  totalLbp: Decimal;
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
export function summarizeOwed(
  rows: readonly OwedParticipation[],
  now: Date,
  tabs: readonly OwedTab[] = [],
): OwedSummary {
  const groups = new Map<string, OwedGroup>();
  const games = new Set<string>();
  let totalUsd = new Decimal(0);
  let totalLbp = new Decimal(0);

  for (const row of rows) {
    const remaining = remainingOf(row);
    const owed = Decimal.max(
      personOwedOnBooking({
        collectionMode: row.collectionMode,
        isRequester: row.isRequester,
        bookingRemainingUsd: remaining.booking,
        participantRemainingUsd: remaining.participant,
      }),
      0,
    );
    const lbp = remaining.currency === "LBP";
    if (
      classifyDue({ status: row.status, start: row.start, end: row.end, remaining: owed, now }) !== "owed"
    ) {
      continue;
    }

    if (lbp) totalLbp = totalLbp.plus(owed);
    else totalUsd = totalUsd.plus(owed);
    games.add(row.bookingId);
    const key = row.personId ?? "";
    const group =
      groups.get(key) ??
      ({
        personId: row.personId,
        name: row.personName,
        phone: row.personPhone,
        totalUsd: new Decimal(0),
        totalLbp: new Decimal(0),
        games: 0,
        debts: [],
      } satisfies OwedGroup);
    if (lbp) group.totalLbp = group.totalLbp.plus(owed);
    else group.totalUsd = group.totalUsd.plus(owed);
    group.debts.push({
      kind: "game",
      bookingId: row.bookingId,
      status: row.status,
      start: row.start,
      end: row.end,
      pitchName: row.pitchName,
      owedUsd: lbp ? new Decimal(0) : owed,
      owedLbp: lbp ? owed : new Decimal(0),
    });
    groups.set(key, group);
  }

  // Player tabs: unpaid shop items, owed on the same terms as the game they belong to. A tab opened
  // under a typed name is grouped by that name (case-insensitive), apart from any person.
  for (const tab of tabs) {
    const owed = Decimal.max(tab.remainingUsd, 0);
    if (classifyDue({ status: tab.status, start: tab.start, end: tab.end, remaining: owed, now }) !== "owed") continue;

    totalUsd = totalUsd.plus(owed);
    games.add(tab.bookingId);
    const key = tab.personId ?? `name:${tab.name.trim().toLowerCase()}`;
    const group =
      groups.get(key) ??
      ({
        personId: tab.personId,
        name: tab.name,
        phone: tab.phone,
        totalUsd: new Decimal(0),
        totalLbp: new Decimal(0),
        games: 0,
        debts: [],
      } satisfies OwedGroup);
    group.totalUsd = group.totalUsd.plus(owed);
    group.debts.push({
      kind: "tab",
      bookingId: tab.bookingId,
      status: tab.status,
      start: tab.start,
      end: tab.end,
      pitchName: tab.pitchName,
      owedUsd: owed,
      owedLbp: new Decimal(0),
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
  return { totalUsd, totalLbp, games: games.size, groups: ordered };
}
