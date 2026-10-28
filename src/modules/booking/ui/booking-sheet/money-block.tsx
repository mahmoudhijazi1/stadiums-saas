import Decimal from "decimal.js";
import { useState } from "react";
import { CircleAlert, CircleCheck } from "lucide-react";
import type { UiLocale } from "@/lib/locale";
import { ui } from "@/lib/copy";
import { formatPrice } from "@/lib/format/money";
import { Figure } from "@/components/ui/figure";
import { SubmitButton } from "@/components/ui/submit-button";
import { LtrIsolate } from "@/components/ui/ltr-isolate";
import { cn } from "cn";
import { isForgivable } from "@/modules/payment/domain/units";
import { PerPlayerCollect } from "@/modules/booking/ui/per-player-collect";
import type { PerPlayerResult } from "@/modules/booking/ui/action-types";
import { CollectAdvance, type AdvanceStep } from "@/modules/booking/ui/booking-sheet/collect-advance";
import { OtherAmountForm, OtherAmountToggle } from "@/modules/booking/ui/booking-sheet/other-amount";
import { collectMode, isPerPlayer, owesCash, type UpcomingRowView } from "@/modules/booking/ui/booking-sheet/row-view";

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
  /** Something was paid and something is left: the card adds "Game price X · Paid Y". */
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

const TONE: Record<MoneyTone, { text: string; bg: string; label: string }> = {
  owed: { text: "text-owed", bg: "bg-owed-subtle", label: "owner.remaining" },
  paid: { text: "text-paid", bg: "bg-paid-subtle", label: "owner.paid" },
  expected: { text: "text-foreground", bg: "bg-expected-subtle", label: "owner.expectedLabel" },
};

/**
 * The money card (ui-rules rule 1, by state): amber "Remaining" when owed, green "✓ Paid" when settled,
 * neutral "Expected" before the game. The remaining is the sheet's one big figure (rule 7); after a part
 * payment one muted line says the game price and what was paid. No button inside the card.
 */
export function MoneyCard({ money, locale }: { money: GameMoneyView; locale: UiLocale }) {
  const tone = TONE[money.tone];
  const Icon = money.tone === "paid" ? CircleCheck : money.tone === "owed" ? CircleAlert : null;
  const amount = (value: string) => formatPrice({ currency: money.currency, amount: value }, locale);
  return (
    <div data-tone={money.tone} className={cn("flex flex-col gap-1 rounded-xl px-4 py-3 text-start", tone.bg)}>
      <p className={cn("type-caption flex items-center gap-1", money.tone === "expected" ? "text-muted-foreground" : tone.text)}>
        {Icon ? <Icon aria-hidden className="size-3.5 shrink-0" /> : null}
        {ui(tone.label, locale)}
      </p>
      <Figure className={cn("text-3xl leading-tight", tone.text)}>{amount(money.tone === "paid" ? money.paid : money.remaining)}</Figure>
      {money.partial ? (
        <p className="type-caption">
          {ui("owner.gamePrice", locale)} <LtrIsolate>{amount(money.price)}</LtrIsolate>
          <span aria-hidden> · </span>
          {ui("owner.paid", locale)} <LtrIsolate>{amount(money.paid)}</LtrIsolate>
        </p>
      ) : null}
    </div>
  );
}

/**
 * The money block of the sheet: the card, then the sheet's ONE primary button "Collect <exact remaining>"
 * (it collects exactly that), then the secondary "Other amount or currency" form, then "Consider it paid"
 * and the player shares. Before the game there is no primary Collect: "Collect in advance" asks first
 * (v1.9.1). A paid game has no Collect at all. Every action is the existing Server Action.
 */
export function MoneyBlock({
  row,
  lbpPerUsd,
  locale,
  mayCollect,
  collectActions,
}: {
  row: UpcomingRowView;
  lbpPerUsd: string | null;
  locale: UiLocale;
  mayCollect: boolean;
  /** Kept for the callers: the split switch that needs it now lives in More actions. */
  mayAdjust?: boolean;
  collectActions: CollectActions;
}) {
  const [otherOpen, setOtherOpen] = useState(false);
  const [advance, setAdvance] = useState<AdvanceStep>("idle");
  const mode = collectMode(row);
  const money = gameMoneyOf(row);
  const showCollect = mode === "primary" || (mode === "advance" && advance === "open");
  const canCollect = mayCollect && showCollect && !isPerPlayer(row) && money.tone !== "paid";
  const gate = mayCollect && mode === "advance" && advance !== "open" && !isPerPlayer(row);
  const { submitCollectAllRemaining, submitCollectPayment, submitCollectSlot, submitConsiderPaid, submitConsiderSharePaid } =
    collectActions;
  const rate = lbpPerUsd ? new Decimal(lbpPerUsd) : null;
  const forgivable =
    canCollect && mode === "primary" && submitConsiderPaid && isForgivable(new Decimal(money.remaining), money.currency, rate);
  const field = money.currency === "LBP" ? "lbpAmount" : "usdAmount";

  return (
    <section className="flex flex-col gap-3">
      <MoneyCard money={money} locale={locale} />
      {gate ? <CollectAdvance step={advance} onStep={setAdvance} locale={locale} /> : null}
      {canCollect ? (
        <form action={submitCollectPayment}>
          <input type="hidden" name="bookingId" value={row.id} />
          <input type="hidden" name={field} value={money.remaining} />
          <SubmitButton className="w-full">
            {ui("owner.collect", locale)} <LtrIsolate>{formatPrice({ currency: money.currency, amount: money.remaining }, locale)}</LtrIsolate>
          </SubmitButton>
        </form>
      ) : null}
      {canCollect ? <OtherAmountToggle open={otherOpen} onToggle={() => setOtherOpen((open) => !open)} locale={locale} /> : null}
      {canCollect && otherOpen ? (
        <OtherAmountForm
          id={`game-${row.id}`}
          currency={money.currency}
          remaining={money.remaining}
          lbpPerUsd={lbpPerUsd}
          locale={locale}
          submit={{ kind: "action", action: submitCollectPayment, hidden: { bookingId: row.id } }}
        />
      ) : null}
      {forgivable ? <ConsiderPaidButton bookingId={row.id} locale={locale} submitConsiderPaid={submitConsiderPaid} /> : null}
      <PerPlayerCollect
        submitCollectAllRemaining={submitCollectAllRemaining}
        submitCollectSlot={submitCollectSlot}
        submitConsiderSharePaid={submitConsiderSharePaid}
        view={row.perPlayer}
        mayCollect={mayCollect}
        advanceNeeded={mode === "advance"}
        lbpPerUsd={lbpPerUsd}
        locale={locale}
      />
    </section>
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
      <SubmitButton variant="ghost" size="sm" className="-ms-3 min-h-11 rounded-full px-3 type-label text-muted-foreground">
        {ui("owner.considerPaid", locale)}
      </SubmitButton>
    </form>
  );
}
