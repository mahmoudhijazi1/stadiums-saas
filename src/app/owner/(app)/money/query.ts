import type { LedgerPeriodQuery } from "@/modules/ledger/schemas/period-query";

/**
 * The Money tab's own URL state. A named period keeps just `period`; custom keeps from/to.
 * Pure, so the links, the sheet and the redirect after saving an expense agree.
 */
export function moneyHref(
  query: Partial<Pick<LedgerPeriodQuery, "period" | "from" | "to" | "view" | "displayRate" | "filter">>,
  extra: Record<string, string> = {},
): string {
  const params = new URLSearchParams();
  if (query.from && query.to) {
    params.set("from", query.from);
    params.set("to", query.to);
  } else if (query.period && query.period !== "month") {
    params.set("period", query.period);
  }
  if (query.view && query.view !== "usd") params.set("view", query.view);
  if (query.displayRate) params.set("displayRate", query.displayRate);
  if (query.filter && query.filter !== "all") params.set("filter", query.filter);
  for (const [key, value] of Object.entries(extra)) params.set(key, value);
  const qs = params.toString();
  return qs ? `/owner/money?${qs}` : "/owner/money";
}
