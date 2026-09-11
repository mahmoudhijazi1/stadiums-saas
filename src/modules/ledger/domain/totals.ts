import Decimal from "decimal.js";

/**
 * Notebook net for a period (SPEC-08 / BR-54). IN minus OUT. Negative is allowed.
 */
export function netUsd(inUsd: Decimal, outUsd: Decimal): Decimal {
  return inUsd.minus(outUsd);
}

/**
 * View transform only (BR-56 / RULE-4). Never stored. Integer LBP pounds.
 */
export function usdToDisplayLbp(
  amountUsd: Decimal,
  lbpPerUsd: Decimal,
): Decimal {
  return amountUsd.times(lbpPerUsd).toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
}
