import Decimal from "decimal.js";

/**
 * CSS bar widths from the two period totals. Visual only — not money math
 * for the ledger. Zero vs zero → empty bars.
 */
export function inOutBarPercents(
  inUsd: Decimal,
  outUsd: Decimal,
): { inPct: string; outPct: string } {
  const max = Decimal.max(inUsd, outUsd);
  if (max.lte(0)) return { inPct: "0", outPct: "0" };
  return {
    inPct: inUsd.div(max).times(100).toFixed(0),
    outPct: outUsd.div(max).times(100).toFixed(0),
  };
}
