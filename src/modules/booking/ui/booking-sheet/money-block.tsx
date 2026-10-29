import Decimal from "decimal.js";
import { Check, ChevronRight, CircleAlert, CircleCheck, Users } from "lucide-react";
import type { UiLocale } from "@/lib/locale";
import { ui } from "@/lib/copy";
import { formatPrice } from "@/lib/format/money";
import { SubmitButton } from "@/components/ui/submit-button";
import { LtrIsolate } from "@/components/ui/ltr-isolate";
import { cn } from "cn";
import { isForgivable } from "@/modules/payment/domain/units";
import type { PerPlayerResult } from "@/modules/booking/ui/action-types";
import { CollectAdvance, type AdvanceStep } from "@/modules/booking/ui/booking-sheet/collect-advance";
import { collectMode, isPerPlayer, owesCash, type CollectMode, type UpcomingRowView } from "@/modules/booking/ui/booking-sheet/row-view";

/** The collect actions of the sheet: whole collect, two-currency, per-player switches and slot collects. */
export type CollectActions = {
  submitCollectPayment: (formData: FormData) => Promise<void>;
  submitSwitchToPerPlayer: (input: { bookingId: string; count: number }) => Promise<PerPlayerResult>;
  submitSwitchToWhole: (input: { bookingId: string }) => Promise<PerPlayerResult>;
  submitCollectSlot: (input: { bookingId: string; participantId: string; usdAmount?: string; lbpAmount?: string; keepChange?: boolean }) => Promise<PerPlayerResult>;
  submitCollectAllRemaining: (input: { bookingId: string }) => Promise<PerPlayerResult>;
  /** "Consider it paid" (DR-007 decision 8). Absent: the button is not shown. */
  submitConsiderPaid?: (formData: FormData) => Promise<void>;
  /** "Consider it paid" on one share of a split game (DR-007 slice 7). Absent: not shown. */
  submitConsiderSharePaid?: (input: { bookingId: string; participantId: string }) => Promise<PerPlayerResult>;
};

export type MoneyTone = "paid" | "owed" | "expected";

/** The money of one game in its own currency: what is left, the price and what was paid ("30.00" or whole pounds). */
export type GameMoneyView = {
  currency: "USD" | "LBP";
  remaining: string;
  price: string;
  paid: string;
  tone: MoneyTone;
  /** Something was paid and something is left. */
  partial: boolean;
};

/** Paid = nothing left, owed = the game ended (or a fee is due) and money is left, expected = not played yet. */
export function gameMoneyOf(row: UpcomingRowView): GameMoneyView {
  const currency = row.lbp ? "LBP" : "USD";
  const remaining = row.lbp ? row.lbp.remaining : row.remainingUsd;
  const left = new Decimal(remaining);
  const paid = row.collectedExact;
  const tone: MoneyTone = left.lte(0) || row.lbp?.settled ? "paid" : owesCash(row) ? "owed" : "expected";
  return { currency, remaining, price: row.priceUsd, paid, tone, partial: left.gt(0) && new Decimal(paid).gt(0) };
}

/**
 * What the sheet offers for money, one rule for both currencies (`collectMode`, v1.9.1): `collectNow` is
 * the bottom bar's one primary Collect (an ended game or a fee, or a game whose "Collect in advance" was
 * confirmed); `gate` is the secondary "Collect in advance" in the money row before the game; forgiving
 * needs an ended game. A split game is collected share by share in its own view.
 */
export type CollectState = { mode: CollectMode; collectNow: boolean; gate: boolean; forgivable: boolean };

export function collectStateOf(input: {
  row: UpcomingRowView;
  mayCollect: boolean;
  advance: AdvanceStep;
  lbpPerUsd: string | null;
  mayForgive: boolean;
}): CollectState {
  const { row, mayCollect, advance } = input;
  const mode = collectMode(row);
  const money = gameMoneyOf(row);
  const whole = mayCollect && !isPerPlayer(row) && money.tone !== "paid";
  const collectNow = whole && (mode === "primary" || (mode === "advance" && advance === "open"));
  const gate = whole && mode === "advance" && advance !== "open";
  const rate = input.lbpPerUsd ? new Decimal(input.lbpPerUsd) : null;
  const forgivable =
    collectNow && mode === "primary" && input.mayForgive && isForgivable(new Decimal(money.remaining), money.currency, rate);
  return { mode, collectNow, gate, forgivable };
}

const ROW_TONE: Record<MoneyTone, string> = {
  owed: "bg-owed-subtle text-owed",
  paid: "bg-paid-subtle text-paid",
  expected: "bg-surface-2 text-foreground",
};

/**
 * Money as ONE row, by state (ui-rules rule 1, words with every colour): owing is an amber "Due" (or
 * "Remaining" after a part payment, with one muted line "of <price> · paid <collected>"); not played
 * yet is a neutral row with the price, "Not paid yet" and the secondary "Collect in advance"; paid is a
 * small green row. A split game says "Split between N · K paid" and opens the shares. "Consider it
 * paid" sits in the row when allowed. The amount is never the primary button here.
 */
export function MoneyRow({
  row,
  state,
  advance,
  onAdvance,
  onShares,
  locale,
  submitConsiderPaid,
}: {
  row: UpcomingRowView;
  state: CollectState;
  advance: AdvanceStep;
  onAdvance: (step: AdvanceStep) => void;
  onShares: () => void;
  locale: UiLocale;
  submitConsiderPaid?: (formData: FormData) => Promise<void>;
}) {
  const money = gameMoneyOf(row);
  const amount = (value: string) => formatPrice({ currency: money.currency, amount: value }, locale);
  // A cancelled game with nothing due and nothing paid has no money to show.
  if (money.tone === "paid" && new Decimal(money.paid).lte(0)) return null;

  if (isPerPlayer(row)) {
    const paidCount = row.perPlayer.slots.filter((slot) => slot.paid).length;
    return (
      <button
        type="button"
        onClick={onShares}
        className={cn(
          "flex min-h-14 w-full items-center gap-3 rounded-xl px-4 py-3 text-start outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
          ROW_TONE[money.tone],
        )}
      >
        <Users aria-hidden className="size-5 shrink-0" />
        <span className="min-w-0 flex-1 type-label">
          {ui("owner.splitBetween", locale)
            .replace("{n}", String(row.perPlayer.slots.length))
            .replace("{k}", String(paidCount))}
        </span>
        {money.tone !== "paid" ? (
          <LtrIsolate className="type-strong">{amount(money.remaining)}</LtrIsolate>
        ) : null}
        <ChevronRight aria-hidden className="size-5 shrink-0 opacity-70 rtl:rotate-180" />
      </button>
    );
  }

  const Icon = money.tone === "paid" ? CircleCheck : money.tone === "owed" ? CircleAlert : null;
  const label =
    money.tone === "paid"
      ? ui("owner.paid", locale)
      : money.tone === "owed"
        ? ui(money.partial ? "owner.remaining" : "owner.moneyDue", locale)
        : ui("owner.notPaidYet", locale);
  return (
    <section data-tone={money.tone} className={cn("flex flex-col gap-2 rounded-xl px-4 py-3", ROW_TONE[money.tone])}>
      <div className="flex min-h-8 items-center gap-2">
        {Icon ? <Icon aria-hidden className="size-5 shrink-0" /> : null}
        <span className="min-w-0 flex-1 type-label">{label}</span>
        <LtrIsolate className={money.tone === "owed" ? "type-title" : "type-strong"}>
          {amount(money.tone === "paid" ? money.paid : money.tone === "owed" ? money.remaining : money.price)}
        </LtrIsolate>
      </div>
      {money.tone === "owed" && money.partial ? (
        <p className="type-caption">
          {ui("owner.ofWord", locale)} <LtrIsolate>{amount(money.price)}</LtrIsolate>
          <span aria-hidden> · </span>
          {ui("owner.paidLower", locale)} <LtrIsolate>{amount(money.paid)}</LtrIsolate>
        </p>
      ) : null}
      {state.gate ? <CollectAdvance step={advance} onStep={onAdvance} locale={locale} /> : null}
      {state.forgivable && submitConsiderPaid ? (
        <ConsiderPaidButton bookingId={row.id} locale={locale} submitConsiderPaid={submitConsiderPaid} />
      ) : null}
    </section>
  );
}

/**
 * The bottom bar of the sheet, only when there is something to collect now: the one primary
 * "Collect <exact remaining>" (it sends exactly that) and the link to "Other amount or currency".
 * Sticky to the bottom of the sheet, above the safe-area inset.
 */
export function CollectBar({
  row,
  locale,
  onOtherAmount,
  submitCollectPayment,
}: {
  row: UpcomingRowView;
  locale: UiLocale;
  onOtherAmount: () => void;
  submitCollectPayment: (formData: FormData) => Promise<void>;
}) {
  const money = gameMoneyOf(row);
  const field = money.currency === "LBP" ? "lbpAmount" : "usdAmount";
  return (
    <div
      data-slot="collect-bar"
      className="sticky bottom-0 z-10 -mx-4 -mb-4 mt-auto flex flex-col items-center gap-1 border-t bg-card px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
    >
      <form action={submitCollectPayment} className="w-full">
        <input type="hidden" name="bookingId" value={row.id} />
        <input type="hidden" name={field} value={money.remaining} />
        <SubmitButton className="h-12 w-full type-button">
          {ui("owner.collect", locale)} <LtrIsolate>{formatPrice({ currency: money.currency, amount: money.remaining }, locale)}</LtrIsolate>
        </SubmitButton>
      </form>
      <button
        type="button"
        onClick={onOtherAmount}
        className="inline-flex min-h-11 items-center gap-1 rounded-full px-3 type-label text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        {ui("owner.otherAmount", locale)}
        <ChevronRight aria-hidden className="size-4 shrink-0 rtl:rotate-180" />
      </button>
    </div>
  );
}

/**
 * "Consider it paid" (DR-007 decision 8): a secondary button, shown only when what is left is
 * forgivable. The use case checks again under the booking lock.
 */
function ConsiderPaidButton({
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
      <SubmitButton variant="ghost" size="sm" className="-ms-3 min-h-11 gap-1 rounded-full px-3 type-label">
        <Check aria-hidden className="size-4" />
        {ui("owner.considerPaid", locale)}
      </SubmitButton>
    </form>
  );
}
