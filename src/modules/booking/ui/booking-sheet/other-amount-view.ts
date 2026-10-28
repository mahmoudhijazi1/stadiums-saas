import Decimal from "decimal.js";
import {
  displayChange,
  formatChange,
  formatLbpAmount,
  formatParts,
  formatUsdAmount,
  formatUsdMoney,
  groupDigits,
} from "@/lib/format/money";
import { isLbpString, isUsdString, normalizeUsdForm, parseLbp, parseUsd } from "@/lib/format/parse-money";
import type { UiLocale } from "@/lib/locale";
import { previewTenders } from "@/modules/payment/domain/tender-preview";
import { friendlyLbp } from "@/modules/payment/domain/units";
import { applyPayment } from "@/modules/shop/domain/pricing";

/**
 * What the "Other amount or currency" form shows as the owner types, for a whole game or one share, in
 * either currency. Pure: the same arithmetic the server applies (`applyPayment` for a game in pounds,
 * `previewTenders` for a game in dollars), so what it shows is what will be recorded. Every amount is
 * written by the money formatters.
 */
export type OtherAmountView = {
  /** "$1 = 89,500 ل.ل": the stadium's current rate; null when none is set. */
  rateLine: string | null;
  /** "$20 = 1,790,000 ل.ل": what the other currency typed covers; null when none is typed. */
  coversLine: string | null;
  /** The one live result line. */
  result:
    | { kind: "owed"; amount: string }
    | { kind: "change"; amount: string }
    | { kind: "exact" }
    | { kind: "rate_missing" }
    | { kind: "bad_usd" }
    | { kind: "bad_lbp" }
    | { kind: "empty" };
  /** "1,790,000 ل.ل + $20": what the confirm records; null when nothing valid is typed. */
  confirmAmount: string | null;
};

function typed(text: string, currency: "USD" | "LBP"): Decimal | null {
  const value = text.trim();
  if (value === "") return new Decimal(0);
  if (currency === "LBP") return isLbpString(value) ? parseLbp(value) : null;
  const normalized = normalizeUsdForm(value);
  return isUsdString(normalized) ? parseUsd(normalized) : null;
}

/** The pounds still needed and, when it differs, the amount rounded up to say out loud ("537,000 LBP, about 540,000"). */
function lbpWithFriendly(amount: Decimal, locale: UiLocale, about: string): string {
  const friendly = friendlyLbp(amount);
  const exact = formatLbpAmount(amount, locale);
  return friendly.equals(amount) ? exact : `${exact}, ${about} ${groupDigits(friendly)}`;
}

export function otherAmountView(input: {
  /** The game's (or the share's) currency. */
  currency: "USD" | "LBP";
  /** What is left in that currency: "30.00" or whole pounds "2000000". */
  remaining: string;
  usdText: string;
  lbpText: string;
  lbpPerUsd: string | null;
  locale: UiLocale;
  /** The word before the rounded pounds ("about" / "حوالي"), from the copy layer. */
  about: string;
}): OtherAmountView {
  const { currency, locale } = input;
  const rate = input.lbpPerUsd && new Decimal(input.lbpPerUsd).gt(0) ? new Decimal(input.lbpPerUsd) : null;
  const rateLine = rate ? `${formatUsdAmount(new Decimal(1))} = ${formatLbpAmount(rate, locale)}` : null;
  const usd = typed(input.usdText, "USD");
  const lbp = typed(input.lbpText, "LBP");
  if (usd === null) return { rateLine, coversLine: null, result: { kind: "bad_usd" }, confirmAmount: null };
  if (lbp === null) return { rateLine, coversLine: null, result: { kind: "bad_lbp" }, confirmAmount: null };
  const confirmAmount = usd.gt(0) || lbp.gt(0) ? formatParts({ lbp, usd }, locale) : null;
  const remaining = new Decimal(input.remaining);

  if (currency === "LBP") {
    if (usd.gt(0) && !rate) return { rateLine, coversLine: null, result: { kind: "rate_missing" }, confirmAmount };
    if (!usd.gt(0) && !lbp.gt(0)) return { rateLine, coversLine: null, result: { kind: "empty" }, confirmAmount };
    const zero = new Decimal(0);
    const application = applyPayment({
      state: { remLbp: remaining, remUsd: zero, outstandingFrozenLbpUsd: zero, outstandingFrozenUsd: zero },
      handed: { lbp, usd },
      // Pounds alone need no rate; a rate of 1 is never used then (no dollars to convert).
      rate: rate ?? new Decimal(1),
    });
    const coveredByUsd = application.lbpApplied.minus(Decimal.min(lbp, remaining));
    const coversLine = usd.gt(0) ? `${formatUsdAmount(usd)} = ${formatLbpAmount(Decimal.max(coveredByUsd, 0), locale)}` : null;
    const change = { lbp: application.changeLbp, usd: application.changeUsd };
    const result: OtherAmountView["result"] = application.remLbpAfter.gt(0)
      ? { kind: "owed", amount: formatLbpAmount(application.remLbpAfter, locale) }
      : change.lbp.gt(0) || change.usd.gt(0)
        ? { kind: "change", amount: formatChange(displayChange(change, rate), locale) }
        : { kind: "exact" };
    return { rateLine, coversLine, result, confirmAmount };
  }

  const preview = previewTenders({ usdText: input.usdText, lbpText: input.lbpText, lbpPerUsd: rate, targetUsd: remaining });
  if (preview.kind === "bad_usd" || preview.kind === "bad_lbp") return { rateLine, coversLine: null, result: { kind: preview.kind }, confirmAmount: null };
  if (preview.kind === "rate_missing") return { rateLine, coversLine: null, result: { kind: "rate_missing" }, confirmAmount };
  if (preview.kind === "empty") return { rateLine, coversLine: null, result: { kind: "empty" }, confirmAmount };
  const coversLine = lbp.gt(0) ? `${formatLbpAmount(lbp, locale)} = ${formatUsdMoney(preview.totalUsd.minus(usd))}` : null;
  const left = preview.remainingUsd ?? new Decimal(0);
  const inPounds = (amount: Decimal | null) => (amount ? ` · ${lbpWithFriendly(amount, locale, input.about)}` : "");
  const result: OtherAmountView["result"] = left.gt(0)
    ? { kind: "owed", amount: `${formatUsdMoney(left)}${inPounds(preview.remainingLbp)}` }
    : left.isZero()
      ? { kind: "exact" }
      : { kind: "change", amount: `${formatUsdMoney(left.abs())}${preview.remainingLbp ? ` · ${formatLbpAmount(preview.remainingLbp, locale)}` : ""}` };
  return { rateLine, coversLine, result, confirmAmount };
}
