import { DomainError } from "@/lib/errors";
import db from "@/lib/db";
import { rethrowUnexpected } from "@/lib/use-case-error";
import { getCurrentMembership } from "@/modules/access/application/get-current-membership";
import { REPORTS_VIEW, can } from "@/modules/access/domain/can";
import {
  ACTIVITY_PAGE_SIZE,
  decodeActivityCursor,
  encodeActivityCursor,
  periodBoundsFromCivilRange,
} from "@/modules/ledger/domain/period";
import {
  listLedgerEntriesPage,
  type LedgerEntryRow,
} from "@/modules/ledger/infrastructure/entries";

const TIME_ZONE = "Asia/Beirut";

export type LedgerActivityPage = {
  entries: LedgerEntryRow[];
  /** Pass back for the next page; null on the last one. */
  nextCursor: string | null;
};

/**
 * Every ledger movement in a civil-date period, newest first, 20 per page. Ledger knows
 * only the source type and id; names come from the owners of those sources (composed in
 * app/). reports.view is checked here.
 */
export async function listLedgerActivity(input: {
  from: string;
  to: string;
  filter?: "all" | "in" | "out";
  cursor?: string;
}): Promise<LedgerActivityPage> {
  const membership = await getCurrentMembership();
  if (!membership || !can(membership, REPORTS_VIEW)) {
    throw new DomainError("access.not_allowed");
  }

  try {
    const bounds = periodBoundsFromCivilRange(input.from, input.to, TIME_ZONE);
    const rows = await listLedgerEntriesPage(db, {
      startInclusive: bounds.startInclusive,
      endExclusive: bounds.endExclusive,
      direction: input.filter === "in" ? "IN" : input.filter === "out" ? "OUT" : undefined,
      cursor: decodeActivityCursor(input.cursor) ?? undefined,
      take: ACTIVITY_PAGE_SIZE + 1,
    });
    const entries = rows.slice(0, ACTIVITY_PAGE_SIZE);
    const last = entries.at(-1);
    const hasMore = rows.length > ACTIVITY_PAGE_SIZE && last !== undefined;
    return { entries, nextCursor: hasMore ? encodeActivityCursor(last.occurredAt, last.id) : null };
  } catch (error) {
    return await rethrowUnexpected(error, "List ledger activity failed", "listLedgerActivity");
  }
}
