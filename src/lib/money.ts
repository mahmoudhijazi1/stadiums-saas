import Decimal from "decimal.js";

/**
 * USD as a decimal string with exactly two fractional digits (BR-40 / DR-002 §2.18).
 * Never parse money with parseFloat / Number.
 */
const USD_PATTERN = /^(?:0|[1-9]\d*)\.\d{2}$/;

export function isUsdString(value: string): boolean {
  return USD_PATTERN.test(value);
}

export function parseUsd(value: string): Decimal {
  if (!isUsdString(value)) {
    throw new Error(
      `Invalid USD amount "${value}" (need a non-negative string with exactly two fractional digits, e.g. "30.00")`,
    );
  }
  return new Decimal(value);
}

export function formatUsd(amount: Decimal): string {
  return amount.toFixed(2);
}

/**
 * Day line and card trails. Whole dollars drop the cents (`30`).
 * A non-zero fraction stays (`12.50`). Exact views keep `formatUsd`.
 */
export function formatUsdCompact(amount: Decimal): string {
  const fixed = amount.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2);
  return fixed.endsWith(".00") ? fixed.slice(0, -3) : fixed;
}

/**
 * Display USD with the sign outside the currency symbol.
 * `formatUsd(-40)` is "-40.00"; callers that do `$` + that get "$-40.00".
 * Use this for any signed UI amount (e.g. period net).
 */
export function formatUsdMoney(amount: Decimal): string {
  const digits = formatUsd(amount.abs());
  return amount.isNegative() ? `-$${digits}` : `$${digits}`;
}

/**
 * Form convenience (G-1): "30" means "30.00". "30.0" stays invalid.
 */
export function normalizeUsdForm(value: string): string {
  if (/^(?:0|[1-9]\d*)$/.test(value)) {
    return `${value}.00`;
  }
  return value;
}

/** LBP as a whole-pound string, no fractional pounds (DR-002 §2.18). */
const LBP_PATTERN = /^(?:0|[1-9]\d*)$/;

export function isLbpString(value: string): boolean {
  return LBP_PATTERN.test(value);
}

export function parseLbp(value: string): Decimal {
  if (!isLbpString(value)) {
    throw new Error(
      `Invalid LBP amount "${value}" (need a non-negative integer string, e.g. "900000")`,
    );
  }
  return new Decimal(value);
}
