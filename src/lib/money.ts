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
