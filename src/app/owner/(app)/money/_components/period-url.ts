import { ZodError } from "zod";
import {
  parseLedgerPeriodQuery,
  type LedgerPeriodQuery,
} from "@/modules/ledger/schemas/period-query";
import { rangeForPeriod, type CivilRange, type PeriodKind } from "@/modules/ledger/domain/period";
import { OWNER_TIME_ZONE } from "@/lib/format/time";
import { queryString } from "@/lib/search-params";

/** The Money pages' URL state (period, filter, custom range, view), shared by Money and Activity. */
export function readPeriodQuery(params: {
  period?: string | string[];
  filter?: string | string[];
  from?: string | string[];
  to?: string | string[];
  view?: string | string[];
  displayRate?: string | string[];
}): LedgerPeriodQuery {
  try {
    return parseLedgerPeriodQuery({
      period: queryString(params.period),
      filter: queryString(params.filter),
      from: queryString(params.from),
      to: queryString(params.to),
      view: queryString(params.view),
      displayRate: queryString(params.displayRate),
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return {
        period: undefined,
        filter: "all",
        from: undefined,
        to: undefined,
        view: undefined,
        displayRate: undefined,
      };
    }
    throw error;
  }
}

/** The URL state with the view settled: `view` is always "usd" or "lbp". */
export type ResolvedPeriodQuery = LedgerPeriodQuery & { view: "usd" | "lbp" };

/**
 * The view the page opens on (DR-007): an explicit `?view=` wins; with none, the stadium's own
 * currency (a stadium that prices games in pounds opens on LBP).
 */
export function withDefaultView(query: LedgerPeriodQuery, gamePriceCurrency: "USD" | "LBP"): ResolvedPeriodQuery {
  return { ...query, view: query.view ?? (gamePriceCurrency === "LBP" ? "lbp" : "usd") };
}

/** The period the URL names: a from/to pair is "custom", otherwise a named period, this month by default. */
export function resolvePeriod(periodQuery: LedgerPeriodQuery, now: Date): { kind: PeriodKind; range: CivilRange } {
  const kind: PeriodKind =
    periodQuery.from && periodQuery.to ? "custom" : (periodQuery.period ?? "month");
  const range =
    periodQuery.from && periodQuery.to
      ? { from: periodQuery.from, to: periodQuery.to }
      : rangeForPeriod(kind === "custom" ? "month" : kind, now, OWNER_TIME_ZONE);
  return { kind, range };
}
