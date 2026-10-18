import Decimal from "decimal.js";
import { classifyDue } from "@/modules/booking/domain/classify-due";

export type DaySummaryStatus = "APPROVED" | "CANCELLED" | "NO_SHOW";

/**
 * One row already loaded for a Beirut start-day. Not a Prisma type. A USD game carries its due in
 * dollars and what its tenders collected; an LBP game (DR-007) carries its due and what its
 * settlements applied in pounds. `collectedUsd` is the ledger's dollars either way.
 */
export type DaySummaryRow = {
  status: DaySummaryStatus;
  start: Date;
  end: Date;
  collectedUsd: Decimal;
  /** Unpaid player tabs on the game: owed (or expected) on top of the booking remaining. */
  tabsRemainingUsd?: Decimal;
} & (
  | { amountDueUsd: Decimal; amountDueLbp?: undefined; settledLbp?: undefined }
  | { amountDueLbp: Decimal; settledLbp: Decimal; amountDueUsd?: undefined }
);

export type DaySummary = {
  /** APPROVED only. Cancelled and no-show are not games. */
  games: number;
  noShows: number;
  /** USD collected on every row, including cancelled and no-show. */
  collectedUsd: Decimal;
  /** classifyDue "owed" on these rows: dollars, and pounds from LBP games (never added together). */
  owedUsd: Decimal;
  owedLbp: Decimal;
  /** classifyDue "expected" on these rows. */
  expectedUsd: Decimal;
  expectedLbp: Decimal;
};

/**
 * Day line for Today. Uses the rows the day list already loaded.
 */
export function summarizeDay(rows: DaySummaryRow[], now: Date): DaySummary {
  let games = 0;
  let noShows = 0;
  let collectedUsd = new Decimal(0);
  let owedUsd = new Decimal(0);
  let owedLbp = new Decimal(0);
  let expectedUsd = new Decimal(0);
  let expectedLbp = new Decimal(0);

  for (const row of rows) {
    collectedUsd = collectedUsd.plus(row.collectedUsd);
    if (row.status === "NO_SHOW") noShows += 1;
    if (row.status === "APPROVED") games += 1;

    // The game's own remaining in its currency; a tab is always dollars.
    const lbp = row.amountDueLbp !== undefined;
    const game = lbp
      ? Decimal.max(row.amountDueLbp.minus(row.settledLbp), 0)
      : Decimal.max(row.amountDueUsd.minus(row.collectedUsd), 0);
    const tabs = new Decimal(row.tabsRemainingUsd ?? 0);
    const kind = classifyDue({
      status: row.status,
      start: row.start,
      end: row.end,
      remaining: game.plus(tabs),
      now,
    });
    const usd = lbp ? tabs : game.plus(tabs);
    const pounds = lbp ? game : new Decimal(0);
    if (kind === "owed") {
      owedUsd = owedUsd.plus(usd);
      owedLbp = owedLbp.plus(pounds);
    }
    if (kind === "expected") {
      expectedUsd = expectedUsd.plus(usd);
      expectedLbp = expectedLbp.plus(pounds);
    }
  }

  return { games, noShows, collectedUsd, owedUsd, owedLbp, expectedUsd, expectedLbp };
}
