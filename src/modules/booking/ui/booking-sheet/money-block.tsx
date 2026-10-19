import Decimal from "decimal.js";
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
import { isForgivable } from "@/modules/payment/domain/units";
import { ConsiderPaidButton, LbpCollectForm } from "@/modules/booking/ui/booking-sheet/lbp-collect";
import { PerPlayerCollect } from "@/modules/booking/ui/per-player-collect";
import type { PerPlayerResult } from "@/modules/booking/ui/action-types";
import { isPerPlayer, owesCash, splitAdjustOf, type UpcomingRowView } from "@/modules/booking/ui/booking-sheet/row-view";

/** The collect actions of the sheet: whole collect, two-currency, per-player switches and slot collects. */
export type CollectActions = {
  submitCollectPayment: (formData: FormData) => Promise<void>;
  submitSwitchToPerPlayer: (input: { bookingId: string; count: number }) => Promise<PerPlayerResult>;
  submitSwitchToWhole: (input: { bookingId: string }) => Promise<PerPlayerResult>;
  submitCollectSlot: (input: { bookingId: string; participantId: string; usdAmount?: string; lbpAmount?: string }) => Promise<PerPlayerResult>;
  submitCollectAllRemaining: (input: { bookingId: string }) => Promise<PerPlayerResult>;
  /** "Consider it paid" (DR-007 decision 8). Absent: the button is not shown. */
  submitConsiderPaid?: (formData: FormData) => Promise<void>;
  /** "Consider it paid" on one share of a split game (DR-007 slice 7). Absent: not shown. */
  submitConsiderSharePaid?: (input: { bookingId: string; participantId: string }) => Promise<PerPlayerResult>;
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
  amountText,
  tone,
  locale,
  action,
}: {
  paidUsd: string;
  remainingUsd: string;
  /** The amount already written with its currency (an LBP game); replaces the dollar figure. */
  amountText?: string;
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
          <LtrIsolate>{amountText ?? `$${tone === "paid" ? paidUsd : remainingUsd}`}</LtrIsolate>
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
  const { submitCollectAllRemaining, submitCollectPayment, submitCollectSlot, submitConsiderPaid, submitConsiderSharePaid, submitSwitchToPerPlayer, submitSwitchToWhole } =
    collectActions;
  const rate = lbpPerUsd ? new Decimal(lbpPerUsd) : null;
  // An LBP game (DR-007 slices 6 and 7): the due in pounds, Collect and the two-currency form,
  // "Consider it paid" under 5,000 LBP, and the per-player split. Extend, cancel fees and adjust stay
  // hidden (slice 8).
  if (row.lbp) {
    const lbp = row.lbp;
    const tone: MoneyTone = lbp.settled ? "paid" : owesCash(row) ? "owed" : "expected";
    const canCollectLbp = mayCollect && !lbp.settled && !isPerPlayer(row);
    const forgivable = canCollectLbp && submitConsiderPaid && isForgivable(new Decimal(lbp.remaining), "LBP", rate);
    return (
      <section className="flex flex-col gap-3">
        <DueRemainingFigures
          paidUsd={row.collectedExact}
          remainingUsd={row.remainingUsd}
          amountText={lbp.settled ? lbp.paid : lbp.due}
          tone={tone}
          locale={locale}
          action={
            canCollectLbp && !mixedOpen ? (
              <form action={submitCollectPayment} className="shrink-0">
                <input type="hidden" name="bookingId" value={row.id} />
                <input type="hidden" name="lbpAmount" value={lbp.remaining} />
                <SubmitButton variant="outline" className={collectButtonClass(tone)}>
                  {ui("owner.collect", locale)}
                </SubmitButton>
              </form>
            ) : null
          }
        />
        {canCollectLbp ? <PayAnotherWayToggle open={mixedOpen} onToggle={() => setMixedOpen((open) => !open)} locale={locale} /> : null}
        {canCollectLbp && mixedOpen ? (
          <LbpCollectForm bookingId={row.id} remainingLbp={lbp.remaining} lbpPerUsd={lbpPerUsd} locale={locale} submitCollectPayment={submitCollectPayment} />
        ) : null}
        {forgivable ? <ConsiderPaidButton bookingId={row.id} locale={locale} submitConsiderPaid={submitConsiderPaid} /> : null}
        <PerPlayerCollect submitCollectAllRemaining={submitCollectAllRemaining} submitCollectSlot={submitCollectSlot} submitConsiderSharePaid={submitConsiderSharePaid} submitSwitchToPerPlayer={submitSwitchToPerPlayer} submitSwitchToWhole={submitSwitchToWhole} view={row.perPlayer} part="slots" mayCollect={mayCollect} mayAdjust={splitAdjustOf(row, mayAdjust)} lbpPerUsd={lbpPerUsd} locale={locale} />
      </section>
    );
  }
  const canCollect = mayCollect && owesCash(row) && !isPerPlayer(row);
  const splitAdjust = splitAdjustOf(row, mayAdjust);
  const forgivableUsd = canCollect && submitConsiderPaid && isForgivable(new Decimal(row.remainingUsd), "USD", rate);

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
                <SubmitButton variant="outline" className={collectButtonClass(moneyTone(row))}>
                  {ui("owner.collect", locale)}
                </SubmitButton>
              </form>
            ) : null
          }
        />
        {canCollect ? <PayAnotherWayToggle open={mixedOpen} onToggle={() => setMixedOpen((open) => !open)} locale={locale} /> : null}
        {canCollect && mixedOpen ? <MixedCollectForm submitCollectPayment={submitCollectPayment} row={row} lbpPerUsd={lbpPerUsd} locale={locale} /> : null}
        {forgivableUsd ? <ConsiderPaidButton bookingId={row.id} locale={locale} submitConsiderPaid={submitConsiderPaid} /> : null}
        <PerPlayerCollect submitCollectAllRemaining={submitCollectAllRemaining} submitCollectSlot={submitCollectSlot} submitConsiderSharePaid={submitConsiderSharePaid} submitSwitchToPerPlayer={submitSwitchToPerPlayer} submitSwitchToWhole={submitSwitchToWhole} view={row.perPlayer} part="slots" mayCollect={mayCollect} mayAdjust={splitAdjust} lbpPerUsd={lbpPerUsd} locale={locale} />
      </section>
  );
}

/** The Collect button: amber once owed, bordered ink before. */
function collectButtonClass(tone: MoneyTone): string {
  return cn(
    "h-11 rounded-full px-5 type-button",
    // The owed row is already amber-tinted, so the button sits on the surface with an amber border to
    // stand out from it (in light mode an amber fill merged with the row; dark keeps the outline's own fill).
    tone === "owed" ? "border-owed/40 bg-surface text-owed hover:bg-surface/80" : "border-line-strong bg-surface-2 text-foreground",
  );
}

/** "Pay another way (LBP, partial)": opens the two-currency form. */
function PayAnotherWayToggle({ open, onToggle, locale }: { open: boolean; onToggle: () => void; locale: UiLocale }) {
  return (
    <button
      type="button"
      aria-expanded={open}
      onClick={onToggle}
      className="-ms-3 inline-flex min-h-11 w-fit items-center gap-1 rounded-full px-3 type-label text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      {open ? ui("owner.hideCollectMixed", locale) : ui("owner.payAnotherWay", locale)}
      <ChevronDown aria-hidden className={cn("size-4 shrink-0 transition-transform", open && "rotate-180")} />
    </button>
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
  const [kept, setKept] = useState(false);

  return (
    <form action={submitCollectPayment} className="flex flex-col gap-4">
      <input type="hidden" name="bookingId" value={row.id} />
      <input type="hidden" name="keepChange" value={kept ? "1" : ""} />
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
        kept={kept}
        onKeptChange={setKept}
      />
      <SubmitButton className="w-full">{ui("owner.moneyGroup", locale)}</SubmitButton>
    </form>
  );
}
