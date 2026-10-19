import { DomainError } from "@/lib/errors";
import type { GamePriceCurrency } from "@/lib/tenant-settings";
import { isLbpPriceString } from "@/modules/venue/domain/schedule-config";

/**
 * The server's check of a pitch's prices against the stadium's currency (DR-007), before a create or
 * an update is written. The currency comes from the stadium's settings, never from the form.
 *
 * - Every LBP price present (the default or a rule's) must be whole pounds, above 0, in steps of
 *   5,000: `venue.lbp_price_unit`. This holds in a USD stadium too, for the pounds that ride along.
 * - An LBP stadium needs an LBP default price: `venue.lbp_price_required`. A rule without pounds is
 *   allowed (a kept time-ranged rule cannot be edited in the form); its slots show no price.
 * - A USD stadium keeps today's rule: the USD default price is required, and the draft schema
 *   already refuses a pitch without it.
 */
export function assertPitchPrices(
  prices: { defaultPriceLbp?: string; priceRules: readonly { priceLbp?: string }[] },
  currency: GamePriceCurrency,
): void {
  const pounds = [prices.defaultPriceLbp, ...prices.priceRules.map((rule) => rule.priceLbp)];
  if (pounds.some((value) => value !== undefined && !isLbpPriceString(value))) {
    throw new DomainError("venue.lbp_price_unit");
  }
  if (currency === "LBP" && prices.defaultPriceLbp === undefined) {
    throw new DomainError("venue.lbp_price_required");
  }
}
