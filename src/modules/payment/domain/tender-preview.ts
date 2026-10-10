import Decimal from "decimal.js";
import { isLbpString, isUsdString, normalizeUsdForm } from "@/lib/format/parse-money";

export type TenderPreview =
  | { kind: "empty" }
  | { kind: "bad_usd" }
  | { kind: "bad_lbp" }
  /** LBP typed but no exchange rate is set: the server would refuse (payment.rate_required). */
  | { kind: "rate_missing" }
  | {
      kind: "ok";
      /** USD part plus LBP part in USD, rounded exactly as the server freezes it. */
      totalUsd: Decimal;
      /** targetUsd − totalUsd. Negative = more than the target. Null without a target. */
      remainingUsd: Decimal | null;
      /** |remainingUsd| in whole LBP at the rate (rounded up). Null without a rate or target. */
      remainingLbp: Decimal | null;
    };

/**
 * Live "what is left" line for a USD + LBP form, computed as the owner types.
 *
 * It accepts exactly what the collect and expense schemas accept ("20" means "20.00";
 * LBP is whole pounds, no separators) and converts LBP the way `usdEquivalent` freezes
 * it (÷ rate, half-up, two places). So the figure shown is the figure the server records.
 * A zero part counts as nothing, as `freezeTenders` drops it.
 */
export function previewTenders(input: {
  usdText: string;
  lbpText: string;
  lbpPerUsd: Decimal | null;
  targetUsd: Decimal | null;
}): TenderPreview {
  const usdRaw = input.usdText.trim();
  const lbpRaw = input.lbpText.trim();
  if (usdRaw === "" && lbpRaw === "") return { kind: "empty" };

  const usdForm = usdRaw === "" ? "" : normalizeUsdForm(usdRaw);
  if (usdForm !== "" && !isUsdString(usdForm)) return { kind: "bad_usd" };
  if (lbpRaw !== "" && !isLbpString(lbpRaw)) return { kind: "bad_lbp" };

  const usd = usdForm === "" ? new Decimal(0) : new Decimal(usdForm);
  const lbp = lbpRaw === "" ? new Decimal(0) : new Decimal(lbpRaw);
  const rate = input.lbpPerUsd && input.lbpPerUsd.gt(0) ? input.lbpPerUsd : null;
  if (lbp.gt(0) && !rate) return { kind: "rate_missing" };

  const lbpInUsd = rate && lbp.gt(0)
    ? lbp.div(rate).toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
    : new Decimal(0);
  const totalUsd = usd.plus(lbpInUsd);
  const remainingUsd = input.targetUsd ? input.targetUsd.minus(totalUsd) : null;
  return {
    kind: "ok",
    totalUsd,
    remainingUsd,
    remainingLbp: remainingUsd && rate ? lbpCovering(remainingUsd.abs(), rate) : null,
  };
}

/**
 * The fewest whole pounds that freeze to at least `usd`: ceil(usd × rate). Typing this
 * amount in the LBP field brings the remaining to exactly zero.
 */
export function lbpCovering(usd: Decimal, lbpPerUsd: Decimal): Decimal {
  return usd.times(lbpPerUsd).toDecimalPlaces(0, Decimal.ROUND_CEIL);
}
