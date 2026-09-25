import Decimal from "decimal.js";
import { classifyDue } from "@/modules/booking/domain/classify-due";

export type DaySummaryStatus = "APPROVED" | "CANCELLED" | "NO_SHOW";

/** One row already loaded for a Beirut start-day. Not a Prisma type. */
export type DaySummaryRow = {
  status: DaySummaryStatus;
  start: Date;
  end: Date;
  amountDueUsd: Decimal;
  collectedUsd: Decimal;
};

export type DaySummary = {
  /** APPROVED only. Cancelled and no-show are not games. */
  games: number;
  noShows: number;
  /** USD collected on every row, including cancelled and no-show. */
  collectedUsd: Decimal;
  /** classifyDue "owed" on these rows. */
  owedUsd: Decimal;
  /** classifyDue "expected" on these rows. */
  expectedUsd: Decimal;
};

/**
 * Day line for Today. Uses the rows the day list already loaded.
 */
export function summarizeDay(rows: DaySummaryRow[], now: Date): DaySummary {
  let games = 0;
  let noShows = 0;
  let collectedUsd = new Decimal(0);
  let owedUsd = new Decimal(0);
  let expectedUsd = new Decimal(0);

  for (const row of rows) {
    collectedUsd = collectedUsd.plus(row.collectedUsd);
    if (row.status === "NO_SHOW") noShows += 1;
    if (row.status === "APPROVED") games += 1;

    const remaining = Decimal.max(row.amountDueUsd.minus(row.collectedUsd), 0);
    const kind = classifyDue({
      status: row.status,
      start: row.start,
      end: row.end,
      remaining,
      now,
    });
    if (kind === "owed") owedUsd = owedUsd.plus(remaining);
    if (kind === "expected") expectedUsd = expectedUsd.plus(remaining);
  }

  return { games, noShows, collectedUsd, owedUsd, expectedUsd };
}
