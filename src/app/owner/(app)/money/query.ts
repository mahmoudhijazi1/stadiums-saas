import type { LedgerPeriodQuery } from "@/modules/ledger/schemas/period-query";

/**
 * The Money tab's own URL state. A named period keeps just `period`; custom keeps from/to.
 * Pure, so the links, the sheet and the redirect after saving an expense agree.
 */
/**
 * The all-activity page's URL: the period, the view and the In / Out filter ride along, so
 * "In $197" on Money opens the activity already filtered, and a filter chip keeps the period.
 */
export function activityHref(
  query: Partial<Pick<LedgerPeriodQuery, "period" | "from" | "to" | "view" | "displayRate" | "filter">>,
): string {
  const href = moneyHref(query);
  return href.replace("/owner/money", "/owner/money/activity");
}

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
