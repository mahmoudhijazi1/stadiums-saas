"use client";

import { useState, type FormEvent } from "react";
import { Check, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LbpInput } from "@/components/ui/lbp-input";
import { Label } from "@/components/ui/label";
import { LtrIsolate } from "@/components/ui/ltr-isolate";
import { SubmitButton } from "@/components/ui/submit-button";
import { ui } from "@/lib/copy";
import { errorMessage } from "@/lib/copy/errors";
import { currencyLabel } from "@/lib/format/money";
import type { UiLocale } from "@/lib/locale";
import { cn } from "cn";
import { KeepItButton } from "@/modules/payment/ui/keep-it";
import { otherAmountView } from "@/modules/booking/ui/booking-sheet/other-amount-view";

export type OtherCash = { lbpAmount: string; usdAmount: string; keepChange: boolean };

/**
 * "Other amount or currency" (AR: مبلغ آخر أو عملة أخرى): the same wording open or closed, the chevron
 * shows the state. A secondary control, never the sheet's primary button.
 */
export function OtherAmountToggle({ open, onToggle, locale }: { open: boolean; onToggle: () => void; locale: UiLocale }) {
  return (
    <button
      type="button"
      aria-expanded={open}
      onClick={onToggle}
      className="-ms-3 inline-flex min-h-11 w-fit items-center gap-1 rounded-full px-3 type-label text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      {ui("owner.otherAmount", locale)}
      <ChevronDown aria-hidden className={cn("size-4 shrink-0 transition-transform", open && "rotate-180")} />
    </button>
  );
}

/**
 * One form for every other way to pay, on a whole game and on a per-player share, in both currencies:
 * the two fields (pounds and dollars, each labelled with `currencyLabel`, the game's currency first and
 * filled with what is left), the rate line, what the other currency covers, exactly one live result
 * line (Still owed / Give back with "Keep it" / Exact amount) and a confirm that names what it records.
 * A whole game submits the real Server Action as a form; a share hands the cash to `onPay`.
 */
export function OtherAmountForm({
  id,
  currency,
  remaining,
  lbpPerUsd,
  locale,
  submit,
}: {
  /** Unique per form on the sheet (field ids). */
  id: string;
  currency: "USD" | "LBP";
  /** What is left in that currency: "30.00" or whole pounds. */
  remaining: string;
  lbpPerUsd: string | null;
  locale: UiLocale;
  submit:
    | { kind: "action"; action: (formData: FormData) => Promise<void>; hidden: Record<string, string> }
    | { kind: "callback"; onPay: (cash: OtherCash) => void; busy: boolean };
}) {
  const [lbp, setLbp] = useState(currency === "LBP" ? remaining : "");
  const [usd, setUsd] = useState(currency === "USD" ? remaining : "");
  const [kept, setKept] = useState(false);
  const view = otherAmountView({ currency, remaining, usdText: usd, lbpText: lbp, lbpPerUsd, locale, about: ui("owner.aboutAmount", locale) });
  const action = submit.kind === "action";
  const ready = view.confirmAmount !== null && !["rate_missing", "bad_usd", "bad_lbp"].includes(view.result.kind);
  const hasChange = view.result.kind === "change";

  const lbpField = (
    <div key="lbp" className="flex flex-col gap-2">
      <Label htmlFor={`${id}-lbp`}>{currencyLabel("LBP", locale)}</Label>
      <LbpInput id={`${id}-lbp`} name={action ? "lbpAmount" : undefined} value={lbp} onValueChange={setLbp} />
    </div>
  );
  const usdField = (
    <div key="usd" className="flex flex-col gap-2">
      <Label htmlFor={`${id}-usd`}>{currencyLabel("USD", locale)}</Label>
      <Input
        id={`${id}-usd`}
        type="text"
        name={action ? "usdAmount" : undefined}
        inputMode="decimal"
        autoComplete="off"
        dir="ltr"
        value={usd}
        onChange={(event) => setUsd(event.target.value)}
      />
    </div>
  );

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    if (submit.kind === "action") return;
    event.preventDefault();
    if (ready) submit.onPay({ lbpAmount: lbp, usdAmount: usd, keepChange: hasChange && kept });
  }

  const confirmLabel = (
    <>
      {ui("owner.collect", locale)}
      {view.confirmAmount ? <LtrIsolate> {view.confirmAmount}</LtrIsolate> : null}
    </>
  );

  return (
    <form action={action ? submit.action : undefined} onSubmit={onSubmit} className="flex flex-col gap-4">
      {action ? Object.entries(submit.hidden).map(([name, value]) => <input key={name} type="hidden" name={name} value={value} />) : null}
      {action ? <input type="hidden" name="keepChange" value={hasChange && kept ? "1" : ""} /> : null}
      {currency === "LBP" ? [lbpField, usdField] : [usdField, lbpField]}
      {view.rateLine ? (
        <p className="type-caption">
          <LtrIsolate>{view.rateLine}</LtrIsolate>
        </p>
      ) : null}
      {view.coversLine ? (
        <p className="type-secondary">
          <LtrIsolate>{view.coversLine}</LtrIsolate>
        </p>
      ) : null}
      <div aria-live="polite" className="empty:hidden">
        <ResultLine view={view} kept={kept} onKept={setKept} locale={locale} />
      </div>
      {action ? (
        <SubmitButton variant="outline" className="w-full" disabled={!ready}>
          {confirmLabel}
        </SubmitButton>
      ) : (
        <Button type="submit" variant="outline" className="w-full" disabled={!ready || submit.busy}>
          {confirmLabel}
        </Button>
      )}
    </form>
  );
}

function ResultLine({
  view,
  kept,
  onKept,
  locale,
}: {
  view: ReturnType<typeof otherAmountView>;
  kept: boolean;
  onKept: (kept: boolean) => void;
  locale: UiLocale;
}) {
  const result = view.result;
  switch (result.kind) {
    case "empty":
      return null;
    case "rate_missing":
      return <p className="type-secondary text-destructive">{errorMessage("payment.rate_required", locale)}</p>;
    case "bad_usd":
    case "bad_lbp":
      return <p className="type-secondary text-owed">{ui(result.kind === "bad_usd" ? "owner.tenderBadUsd" : "owner.tenderBadLbp", locale)}</p>;
    case "exact":
      return (
        <p className="flex items-center gap-1.5 type-label text-paid">
          <Check aria-hidden className="size-4 shrink-0" />
          {ui("owner.exactAmount", locale)}
        </p>
      );
    case "owed":
      return (
        <p className="type-label text-owed">
          {ui("owner.stillOwed", locale)} <LtrIsolate>{result.amount}</LtrIsolate>
        </p>
      );
    case "change":
      return (
        <div className="flex items-center justify-between gap-3">
          <p className="type-label text-owed">
            {ui(kept ? "owner.kept" : "owner.giveBack", locale)} <LtrIsolate>{result.amount}</LtrIsolate>
          </p>
          <KeepItButton kept={kept} onChange={onKept} locale={locale} />
        </div>
      );
  }
}
