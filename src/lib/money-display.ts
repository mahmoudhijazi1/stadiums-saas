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
 * Change as the owner hands it back: whole dollars, and the cents rest in pounds at the current rate
 * (pounds whole, half-up): $5.50 at 90,000 shows as $5 + 45,000 ل.ل. Display only: what is recorded
 * is not touched. Without a rate the dollars stay as they are.
 */
export function displayChange(
  change: { lbp: Decimal | string; usd: Decimal | string },
  rate: Decimal | string | null,
): { lbp: Decimal; usd: Decimal } {
  const lbp = new Decimal(change.lbp.toString());
  const usd = new Decimal(change.usd.toString());
  if (!rate || new Decimal(rate.toString()).lte(0)) return { lbp, usd };
  const whole = usd.floor();
  const cents = usd.minus(whole);
  return { lbp: lbp.plus(cents.times(new Decimal(rate.toString())).toDecimalPlaces(0, Decimal.ROUND_HALF_UP)), usd: whole };
}

/** Change reads dollars first: "$5 + 45,000 ل.ل" (totals read pounds first, see `formatParts`). */
export function formatChange(change: { lbp: Decimal | string; usd: Decimal | string }, locale: UiLocale): string {
  const lbp = new Decimal(change.lbp.toString());
  const usd = new Decimal(change.usd.toString());
  const shown: string[] = [];
  if (usd.gt(0)) shown.push(formatUsdAmount(usd));
  if (lbp.gt(0)) shown.push(formatLbpAmount(lbp, locale));
  return shown.length > 0 ? shown.join(" + ") : "0";
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
