import Decimal from "decimal.js";

export type DaySummaryStatus = "APPROVED" | "CANCELLED" | "NO_SHOW";

/** One row already loaded for a Beirut start-day. Not a Prisma type. */
export type DaySummaryRow = {
  status: DaySummaryStatus;
  start: Date;
  end: Date;
  priceUsd: Decimal;
  collectedUsd: Decimal;
};

export type DaySummary = {
  /** APPROVED only. Cancelled and no-show are not games. */
  games: number;
  noShows: number;
  /** USD collected on every row, including cancelled and no-show. */
  collectedUsd: Decimal;
  /** Remaining on ended APPROVED games, plus remaining on no-shows. */
  owedUsd: Decimal;
  /**
   * Remaining on APPROVED games that have not ended.
   * In progress (start <= now < end) stays here until the end.
   */
  expectedUsd: Decimal;
};

/**
 * Day line for Today. Uses the rows the day list already loaded.
 */
export function summarizeDay(rows: DaySummaryRow[], now: Date): DaySummary {
  const nowMs = now.getTime();
  let games = 0;
  let noShows = 0;
  let collectedUsd = new Decimal(0);
  let owedUsd = new Decimal(0);
  let expectedUsd = new Decimal(0);

  for (const row of rows) {
    collectedUsd = collectedUsd.plus(row.collectedUsd);
    const remaining = Decimal.max(row.priceUsd.minus(row.collectedUsd), 0);

    if (row.status === "NO_SHOW") {
      noShows += 1;
      owedUsd = owedUsd.plus(remaining);
      continue;
    }
    if (row.status !== "APPROVED") continue;

    games += 1;
    if (row.end.getTime() <= nowMs) {
      owedUsd = owedUsd.plus(remaining);
    } else {
      expectedUsd = expectedUsd.plus(remaining);
    }
  }

  return { games, noShows, collectedUsd, owedUsd, expectedUsd };
}
