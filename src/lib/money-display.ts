import Decimal from "decimal.js";
import type { UiLocale } from "@/lib/locale";
import { formatUsdCompact } from "@/lib/money";

/**
 * Display helpers for amounts shown in their own currency (shop items and tabs). Digits are Latin
 * with comma grouping in both languages; callers wrap the result in <LtrIsolate>.
 */

/** "20,000": whole pounds with comma grouping. */
export function groupDigits(amount: Decimal | string): string {
  const whole = new Decimal(amount.toString()).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toFixed(0);
  return whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** The pound sign as written: "ل.ل" in Arabic, "LBP" in English. */
export function lbpUnit(locale: UiLocale): string {
  return locale === "en" ? "LBP" : "ل.ل";
}

/** "20,000 ل.ل" */
export function formatLbpAmount(amount: Decimal | string, locale: UiLocale): string {
  return `${groupDigits(amount)} ${lbpUnit(locale)}`;
}

/** "$1.50" ($2 for a whole dollar, as everywhere else). */
export function formatUsdAmount(amount: Decimal | string): string {
  return `$${formatUsdCompact(new Decimal(amount.toString()))}`;
}

/**
 * An amount that may be owed in both currencies: "60,000 ل.ل + $1.50", or just the part that is
 * not zero. "0" when both are.
 */
export function formatParts(parts: { lbp: Decimal | string; usd: Decimal | string }, locale: UiLocale): string {
  const lbp = new Decimal(parts.lbp.toString());
  const usd = new Decimal(parts.usd.toString());
  const shown: string[] = [];
  if (lbp.gt(0)) shown.push(formatLbpAmount(lbp, locale));
  if (usd.gt(0)) shown.push(formatUsdAmount(usd));
  return shown.length > 0 ? shown.join(" + ") : "0";
}
