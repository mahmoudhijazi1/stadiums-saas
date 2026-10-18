"use client";

import Decimal from "decimal.js";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { LbpInput } from "@/components/ui/lbp-input";
import { Label } from "@/components/ui/label";
import { LtrIsolate } from "@/components/ui/ltr-isolate";
import { SubmitButton } from "@/components/ui/submit-button";
import { ui } from "@/lib/copy";
import { errorMessage } from "@/lib/copy/errors";
import { displayChange, formatChange, formatLbpAmount, formatUsdAmount } from "@/lib/format/money";
import { isLbpString, isUsdString, normalizeUsdForm, parseLbp, parseUsd } from "@/lib/format/parse-money";
import type { UiLocale } from "@/lib/locale";
import { applyPayment } from "@/modules/shop/domain/pricing";

/** A typed amount, or zero while it is empty or not a valid amount yet. */
function typed(text: string, currency: "USD" | "LBP"): Decimal {
  const value = text.trim();
  if (currency === "LBP") return isLbpString(value) ? parseLbp(value) : new Decimal(0);
  const normalized = normalizeUsdForm(value);
  return isUsdString(normalized) ? parseUsd(normalized) : new Decimal(0);
}

/**
 * The live line under the tender fields of an LBP game (DR-007 slice 6): what is still owed in pounds
 * after what is typed, the pounds the typed dollars cover at the current rate, and what to give back.
 * It runs the same `applyPayment` as the server (pounds first, then dollars against what is left), so
 * what it shows is what will be recorded.
 */
export function LbpGameBalance({
  remainingLbp,
  usdText,
  lbpText,
  lbpPerUsd,
  locale,
}: {
  remainingLbp: Decimal;
  usdText: string;
  lbpText: string;
  lbpPerUsd: string | null;
  locale: UiLocale;
}) {
  const rate = lbpPerUsd ? new Decimal(lbpPerUsd) : null;
  const handed = { lbp: typed(lbpText, "LBP"), usd: typed(usdText, "USD") };
  if (!rate || rate.lte(0)) {
    return <p className="text-sm text-destructive">{errorMessage("payment.rate_required", locale)}</p>;
  }
  const zero = new Decimal(0);
  const application = applyPayment({
    state: { remLbp: remainingLbp, remUsd: zero, outstandingFrozenLbpUsd: zero, outstandingFrozenUsd: zero },
    handed,
    rate,
  });
  const left = application.remLbpAfter;
  const coveredByUsd = application.lbpApplied.minus(Decimal.min(handed.lbp, remainingLbp));
  const change = { lbp: application.changeLbp, usd: application.changeUsd };

  return (
    <div className="flex flex-col gap-1" aria-live="polite">
      {handed.usd.gt(0) ? (
        <p className="type-secondary">
          <LtrIsolate>{formatUsdAmount(handed.usd)}</LtrIsolate> {ui("owner.dollarsCover", locale)}{" "}
          <LtrIsolate>{formatLbpAmount(coveredByUsd, locale)}</LtrIsolate>
        </p>
      ) : null}
      <p className="type-secondary">
        {left.isZero() ? (
          ui("owner.tenderPaidInFull", locale)
        ) : (
          <>
            {ui("owner.remaining", locale)}: <LtrIsolate>{formatLbpAmount(left, locale)}</LtrIsolate>
          </>
        )}
      </p>
      {change.lbp.gt(0) || change.usd.gt(0) ? (
        <p className="type-strong text-owed">
          {ui("owner.giveBack", locale)} <LtrIsolate>{formatChange(displayChange(change, rate), locale)}</LtrIsolate>
        </p>
      ) : null}
    </div>
  );
}

/**
 * Pounds and dollars for an LBP game: the pounds field starts at what is left, the dollars field
 * empty. The server keeps only what the game owed and returns the rest as change (DR-007 decision 6).
 */
export function LbpCollectForm({
  bookingId,
  remainingLbp,
  lbpPerUsd,
  locale,
  submitCollectPayment,
}: {
  bookingId: string;
  /** What is left in whole pounds ("210000"). */
  remainingLbp: string;
  lbpPerUsd: string | null;
  locale: UiLocale;
  submitCollectPayment: (formData: FormData) => Promise<void>;
}) {
  const [lbp, setLbp] = useState(remainingLbp);
  const [usd, setUsd] = useState("");

  return (
    <form action={submitCollectPayment} className="flex flex-col gap-4">
      <input type="hidden" name="bookingId" value={bookingId} />
      <div className="flex flex-col gap-2">
        <Label htmlFor={`lbp-${bookingId}`}>{ui("owner.lbp", locale)}</Label>
        <LbpInput id={`lbp-${bookingId}`} name="lbpAmount" value={lbp} onValueChange={setLbp} className="font-mono" />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`usd-${bookingId}`}>USD</Label>
        <Input
          id={`usd-${bookingId}`}
          type="text"
          name="usdAmount"
          inputMode="decimal"
          autoComplete="off"
          value={usd}
          onChange={(event) => setUsd(event.target.value)}
          className="font-mono"
        />
      </div>
      <LbpGameBalance remainingLbp={new Decimal(remainingLbp)} usdText={usd} lbpText={lbp} lbpPerUsd={lbpPerUsd} locale={locale} />
      <SubmitButton className="w-full">{ui("owner.collect", locale)}</SubmitButton>
    </form>
  );
}

/**
 * "Consider it paid" (DR-007 decision 8): a secondary button, shown only when what is left is
 * forgivable. The use case checks again under the booking lock.
 */
export function ConsiderPaidButton({
  bookingId,
  locale,
  submitConsiderPaid,
}: {
  bookingId: string;
  locale: UiLocale;
  submitConsiderPaid: (formData: FormData) => Promise<void>;
}) {
  return (
    <form action={submitConsiderPaid} className="w-fit">
      <input type="hidden" name="bookingId" value={bookingId} />
      <SubmitButton variant="ghost" size="sm" className="-ms-3 min-h-11 rounded-full px-3 type-label text-muted-foreground">
        {ui("owner.considerPaid", locale)}
      </SubmitButton>
    </form>
  );
}
