import { useState, type ReactNode } from "react";
import { ChevronDown, CircleAlert, CircleCheck } from "lucide-react";
import type { UiLocale } from "@/lib/locale";
import { ui } from "@/lib/copy";
import { Input } from "@/components/ui/input";
import { LbpInput } from "@/components/ui/lbp-input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/ui/submit-button";
import { LtrIsolate } from "@/components/ui/ltr-isolate";
import { cn } from "cn";
import { TenderBalance } from "@/modules/payment/ui/tender-balance";
import { PerPlayerCollect } from "@/modules/booking/ui/per-player-collect";
import type { PerPlayerResult } from "@/modules/booking/ui/action-types";
import { isPerPlayer, owesCash, splitAdjustOf, type UpcomingRowView } from "@/modules/booking/ui/booking-sheet/row-view";

/** The collect actions of the sheet: whole collect, two-currency, per-player switches and slot collects. */
export type CollectActions = {
  submitCollectPayment: (formData: FormData) => Promise<void>;
  submitSwitchToPerPlayer: (input: { bookingId: string; count: number }) => Promise<PerPlayerResult>;
  submitSwitchToWhole: (input: { bookingId: string }) => Promise<PerPlayerResult>;
  submitCollectSlot: (input: { bookingId: string; participantId: string }) => Promise<PerPlayerResult>;
  submitCollectAllRemaining: (input: { bookingId: string }) => Promise<PerPlayerResult>;
};

type MoneyTone = "paid" | "owed" | "expected";

const TONE_TEXT: Record<MoneyTone, string> = {
  paid: "text-paid",
  owed: "text-owed",
  expected: "text-expected",
};
const TONE_BG: Record<MoneyTone, string> = {
  paid: "bg-paid-subtle",
  owed: "bg-owed-subtle",
  expected: "bg-expected-subtle",
};

/** Paid = settled, owed = the game ended and money is due, expected = not played yet. */
function moneyTone(row: UpcomingRowView): MoneyTone {
  if (row.remainingUsd === "0.00") return "paid";
  return owesCash(row) ? "owed" : "expected";
}

/**
 * The money block, one row: a tinted container in the state token (paid / owed / expected), the
 * label above the amount on the start side, and the action (Collect) on the end side. Paid and
 * Expected show the same row without a button.
 */
function DueRemainingFigures({
  paidUsd,
  remainingUsd,
  tone,
  locale,
  action,
}: {
  paidUsd: string;
  remainingUsd: string;
  tone: MoneyTone;
  locale: UiLocale;
  action?: ReactNode;
}) {
  const Icon = tone === "paid" ? CircleCheck : tone === "owed" ? CircleAlert : null;
  return (
    <div className={cn("flex items-center gap-3 rounded-xl px-4 py-3 text-start", TONE_BG[tone])}>
      <div className="min-w-0 flex-1">
        <p className={cn("type-caption flex items-center gap-1", TONE_TEXT[tone])}>
          {Icon ? <Icon aria-hidden className="size-3.5 shrink-0" /> : null}
          {ui(
            tone === "paid" ? "owner.paid" : tone === "owed" ? "owner.remaining" : "owner.expectedLabel",
            locale,
          )}
        </p>
        <p className={cn("type-strong", TONE_TEXT[tone])}>
          <LtrIsolate>${tone === "paid" ? paidUsd : remainingUsd}</LtrIsolate>
        </p>
      </div>
      {action}
    </div>
  );
}

/** The money block of the sheet: paid / remaining, Collect, the two-currency form and the player slots. */
export function MoneyBlock({
  row,
  lbpPerUsd,
  locale,
  mayCollect,
  mayAdjust,
  collectActions,
}: {
  row: UpcomingRowView;
  lbpPerUsd: string | null;
  locale: UiLocale;
  mayCollect: boolean;
  mayAdjust: boolean;
  collectActions: CollectActions;
}) {
  const [mixedOpen, setMixedOpen] = useState(false);
  const { submitCollectAllRemaining, submitCollectPayment, submitCollectSlot, submitSwitchToPerPlayer, submitSwitchToWhole } =
    collectActions;
  const canCollect = mayCollect && owesCash(row) && !isPerPlayer(row);
  const splitAdjust = splitAdjustOf(row, mayAdjust);

  return (
      <section className="flex flex-col gap-3">
        <DueRemainingFigures
          paidUsd={row.collectedExact}
          remainingUsd={row.remainingUsd}
          tone={moneyTone(row)}
          locale={locale}
          action={
            canCollect && !mixedOpen ? (
              <form action={submitCollectPayment} className="shrink-0">
                <input type="hidden" name="bookingId" value={row.id} />
                <input type="hidden" name="usdAmount" value={row.remainingUsd} />
                <SubmitButton
                  variant="outline"
                  className={cn(
                    "h-11 rounded-full px-5 type-button",
                    // The same look as a tab's Collect: amber once owed, bordered ink before.
                    moneyTone(row) === "owed"
                      ? "border-transparent bg-owed-subtle text-owed hover:bg-owed-subtle/80"
                      : "border-line-strong bg-surface-2 text-foreground",
                  )}
                >
                  {ui("owner.collect", locale)}
                </SubmitButton>
              </form>
            ) : null
          }
        />
        {canCollect ? (
          <button
            type="button"
            aria-expanded={mixedOpen}
            onClick={() => setMixedOpen((open) => !open)}
            className="-ms-3 inline-flex min-h-11 w-fit items-center gap-1 rounded-full px-3 type-label text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            {mixedOpen ? ui("owner.hideCollectMixed", locale) : ui("owner.payAnotherWay", locale)}
            <ChevronDown aria-hidden className={cn("size-4 shrink-0 transition-transform", mixedOpen && "rotate-180")} />
          </button>
        ) : null}
        {canCollect && mixedOpen ? <MixedCollectForm submitCollectPayment={submitCollectPayment} row={row} lbpPerUsd={lbpPerUsd} locale={locale} /> : null}
        <PerPlayerCollect submitCollectAllRemaining={submitCollectAllRemaining} submitCollectSlot={submitCollectSlot} submitSwitchToPerPlayer={submitSwitchToPerPlayer} submitSwitchToWhole={submitSwitchToWhole} view={row.perPlayer} part="slots" mayCollect={mayCollect} mayAdjust={splitAdjust} locale={locale} />
      </section>
  );
}

/**
 * USD + LBP collect. Both fields are controlled so the line under them shows the total
 * and what is left as the owner types; "Complete with … LBP" fills the rest.
 */
function MixedCollectForm({
  row,
  lbpPerUsd,
  locale,
  submitCollectPayment,
}: {
  row: UpcomingRowView;
  lbpPerUsd: string | null;
  locale: UiLocale;
  submitCollectPayment: (formData: FormData) => Promise<void>;
}) {
  const [usd, setUsd] = useState(row.remainingUsd);
  const [lbp, setLbp] = useState("");

  return (
    <form action={submitCollectPayment} className="flex flex-col gap-4">
      <input type="hidden" name="bookingId" value={row.id} />
      <div className="flex flex-col gap-2">
        <Label htmlFor={`usd-${row.id}`}>{ui("owner.usdRemaining", locale)}</Label>
        <Input
          id={`usd-${row.id}`}
          type="text"
          name="usdAmount"
          inputMode="decimal"
          value={usd}
          onChange={(event) => setUsd(event.target.value)}
          placeholder={row.remainingUsd}
          className="font-mono"
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`lbp-${row.id}`}>{ui("owner.lbp", locale)}</Label>
        <LbpInput id={`lbp-${row.id}`} name="lbpAmount" value={lbp} onValueChange={setLbp} className="font-mono" />
      </div>
      <TenderBalance
        usdText={usd}
        lbpText={lbp}
        lbpPerUsd={lbpPerUsd}
        targetUsd={row.remainingUsd}
        locale={locale}
        onFillLbp={setLbp}
      />
      <SubmitButton className="w-full">{ui("owner.moneyGroup", locale)}</SubmitButton>
    </form>
  );
}
