"use client";

import Decimal from "decimal.js";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LtrIsolate } from "@/components/ui/ltr-isolate";
import { errorMessage } from "@/lib/error-messages";
import type { UiLocale } from "@/lib/locale";
import { formatUsd } from "@/lib/format/money";
import { ui } from "@/lib/ui-copy";
import { previewTenders } from "@/modules/payment/domain/tender-preview";

/** Whole pounds with thousands commas ("895,000 LBP"): long LBP figures are hard to read. */
function lbpText(amount: Decimal, locale: UiLocale): string {
  const grouped = amount.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${grouped} ${ui("owner.lbp", locale)}`;
}

/**
 * Live total and what is left under a USD + LBP form, as the owner types
 * (e.g. $30 due: $20 typed → "Left to complete $10.00 · 895,000 LBP"). Uses `previewTenders`,
 * the same parsing and rounding the server applies, so the figure is the one recorded.
 * With a target and a rate, "Complete with 895,000 LBP" fills the LBP field with what the USD part
 * leaves. Warn, never block: an overpay is shown, not refused (RULE-9/10).
 */
export function TenderBalance({
  usdText,
  lbpText: lbpInput,
  lbpPerUsd,
  targetUsd,
  locale,
  onFillLbp,
}: {
  usdText: string;
  lbpText: string;
  lbpPerUsd: string | null;
  /** What this payment should come to; null for a plain total (expenses). */
  targetUsd: string | null;
  locale: UiLocale;
  onFillLbp?: (lbp: string) => void;
}) {
  const rate = lbpPerUsd ? new Decimal(lbpPerUsd) : null;
  const target = targetUsd ? new Decimal(targetUsd) : null;
  const preview = previewTenders({ usdText, lbpText: lbpInput, lbpPerUsd: rate, targetUsd: target });
  // LBP that completes the USD part alone, so tapping twice never adds twice.
  const fromUsdOnly = previewTenders({ usdText, lbpText: "", lbpPerUsd: rate, targetUsd: target });
  const fill =
    onFillLbp &&
    fromUsdOnly.kind === "ok" &&
    fromUsdOnly.remainingUsd?.gt(0) &&
    fromUsdOnly.remainingLbp
      ? fromUsdOnly.remainingLbp.toFixed(0)
      : null;

  let body: React.ReactNode = null;
  if (preview.kind === "bad_usd" || preview.kind === "bad_lbp") {
    body = (
      <p className="text-sm text-owed">
        {ui(preview.kind === "bad_usd" ? "owner.tenderBadUsd" : "owner.tenderBadLbp", locale)}
      </p>
    );
  } else if (preview.kind === "rate_missing") {
    body = <p className="text-sm text-destructive">{errorMessage("payment.rate_required", locale)}</p>;
  } else if (preview.kind === "ok" && (target !== null || lbpInput.trim() !== "")) {
    // Without a target (expenses) a USD-only total just repeats the field: show it once LBP is in.
    const remaining = preview.remainingUsd;
    body = (
      <>
        <p className="flex items-baseline justify-between gap-3 text-sm text-muted-foreground">
          <span>{ui("owner.tenderTotal", locale)}</span>
          <LtrIsolate className="font-semibold text-foreground">${formatUsd(preview.totalUsd)}</LtrIsolate>
        </p>
        {remaining === null ? null : remaining.gt(0) ? (
          <p className="flex items-baseline justify-between gap-3 text-sm font-medium text-owed">
            <span>{ui("owner.tenderStillDue", locale)}</span>
            <span>
              <LtrIsolate>${formatUsd(remaining)}</LtrIsolate>
              {preview.remainingLbp ? (
                <>
                  <span aria-hidden> · </span>
                  <LtrIsolate>{lbpText(preview.remainingLbp, locale)}</LtrIsolate>
                </>
              ) : null}
            </span>
          </p>
        ) : remaining.isZero() ? (
          <p className="flex items-center gap-1.5 text-sm font-medium text-paid">
            <Check aria-hidden className="size-4" />
            {ui("owner.tenderPaidInFull", locale)}
          </p>
        ) : (
          <p className="flex items-baseline justify-between gap-3 text-sm font-medium text-owed">
            <span>{ui("owner.tenderOver", locale)}</span>
            <span>
              <LtrIsolate>${formatUsd(remaining.abs())}</LtrIsolate>
              {preview.remainingLbp ? (
                <>
                  <span aria-hidden> · </span>
                  <LtrIsolate>{lbpText(preview.remainingLbp, locale)}</LtrIsolate>
                </>
              ) : null}
            </span>
          </p>
        )}
      </>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div aria-live="polite" className="flex flex-col gap-1 empty:hidden">
        {body}
      </div>
      {fill && !(preview.kind === "ok" && preview.remainingUsd?.lte(0)) ? (
        <Button type="button" variant="outline" size="sm" className="self-start" onClick={() => onFillLbp?.(fill)}>
          {ui("owner.tenderFillLbp", locale)}{" "}
          <LtrIsolate>{lbpText(new Decimal(fill), locale)}</LtrIsolate>
        </Button>
      ) : null}
    </div>
  );
}
