"use client";

import Decimal from "decimal.js";
import { LtrIsolate } from "@/components/ui/ltr-isolate";
import { parseLbp, parseUsd, isLbpString, isUsdString, normalizeUsdForm } from "@/lib/money";
import type { UiLocale } from "@/lib/locale";
import { formatParts } from "@/lib/money-display";
import { ui } from "@/lib/ui-copy";
import { applyPayment } from "@/modules/shop/domain/pricing";

/** A typed amount, or zero when it is empty or not a valid amount yet. */
function typed(text: string, currency: "USD" | "LBP"): Decimal {
  const value = text.trim();
  if (currency === "LBP") return isLbpString(value) ? parseLbp(value) : new Decimal(0);
  const normalized = normalizeUsdForm(value);
  return isUsdString(normalized) ? parseUsd(normalized) : new Decimal(0);
}

/**
 * The live line under the tender fields of a sale or tab: what is still owed in each currency after
 * what is typed. It runs the same `applyPayment` as the server, so what it shows is what will happen.
 * `owed` is the pounds and dollars the sale or tab owes now.
 */
export function PartsBalance({
  owed,
  usdText,
  lbpText,
  lbpPerUsd,
  locale,
}: {
  owed: { lbp: Decimal; usd: Decimal };
  usdText: string;
  lbpText: string;
  lbpPerUsd: string | null;
  locale: UiLocale;
}) {
  const rate = lbpPerUsd ? new Decimal(lbpPerUsd) : null;
  const application = applyPayment({
    state: { remLbp: owed.lbp, remUsd: owed.usd, outstandingFrozenLbpUsd: new Decimal(0), outstandingFrozenUsd: new Decimal(0) },
    handed: { lbp: typed(lbpText, "LBP"), usd: typed(usdText, "USD") },
    rate,
  });
  const left = { lbp: application.remLbpAfter, usd: application.remUsdAfter };
  const settled = left.lbp.isZero() && left.usd.isZero();
  const change = { lbp: application.changeLbp, usd: application.changeUsd };
  const hasChange = change.lbp.gt(0) || change.usd.gt(0);

  return (
    <div className="flex flex-col gap-1" aria-live="polite">
      <p className="type-secondary">
        {settled ? (
          ui("owner.paidInFull", locale)
        ) : (
          <>
            {ui("owner.remaining", locale)}: <LtrIsolate>{formatParts(left, locale)}</LtrIsolate>
          </>
        )}
      </p>
      {hasChange ? (
        <p className="type-strong">
          {ui("owner.changeLabel", locale)}: <LtrIsolate>{formatParts(change, locale)}</LtrIsolate>
        </p>
      ) : null}
    </div>
  );
}
