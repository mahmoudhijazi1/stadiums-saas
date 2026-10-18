import { formatUsd } from "@/lib/format/money";
import { formatLocalClock, formatLocalClockRange, type HourCycle } from "@/lib/format/time";
import { ui } from "@/lib/copy";
import type { UiLocale } from "@/lib/locale";
import type { ExtensionOffer } from "@/modules/booking/application/load-extension-offers";
import type { ExtendOfferView } from "@/modules/booking/ui/extend-form";

/**
 * The Extend button's data, for a game in either currency. The three refusals the owner can act on
 * get a disabled button with the reason; every other case (ended, not confirmed, per player) has no
 * offer at all. The added price is written in the game's currency (DR-007 slice 8).
 */
export function extendView(
  row: { start: Date; end: Date },
  offer: ExtensionOffer | undefined,
  hourCycle: HourCycle,
  locale: UiLocale,
  mayEditPrice: boolean,
): ExtendOfferView | null {
  if (!offer) return null;
  const at = (instant: Date | null) => (instant ? formatLocalClock(instant, hourCycle, locale) : "");
  let disabledReason: string | null = null;
  if (!offer.allowed) {
    if (offer.reason === "next_game") disabledReason = ui("owner.extendNextGame", locale).replace("{time}", at(offer.limit));
    else if (offer.reason === "closing") disabledReason = ui("owner.extendClosing", locale).replace("{time}", at(offer.limit));
    else if (offer.reason === "max_duration") disabledReason = ui("owner.extendMax", locale);
    else return null;
  }
  return {
    allowed: offer.allowed,
    disabledReason,
    expectedEndsAt: row.end.toISOString(),
    newRange: formatLocalClockRange(row.start, offer.newEnd, hourCycle, locale),
    currency: offer.currency,
    addedPrice: offer.currency === "LBP" ? offer.addedPrice.toFixed(0) : formatUsd(offer.addedPrice),
    declineCount: offer.declineCount,
    mayEditPrice,
  };
}
