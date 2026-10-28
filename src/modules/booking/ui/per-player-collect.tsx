"use client";

import { useState } from "react";
import Decimal from "decimal.js";
import { Check } from "lucide-react";
import { toast } from "sonner";
import type { UiLocale } from "@/lib/locale";
import { errorMessage } from "@/lib/copy/errors";
import {
  bookerPaysAllLabel,
  changeDescription,
  paidOfLine,
  playerLabel,
  ui,
} from "@/lib/copy";
import { dollars, formatLbpAmount } from "@/lib/format/money";
import { Button } from "@/components/ui/button";
import { LtrIsolate } from "@/components/ui/ltr-isolate";
import { cn } from "cn";
import { TonalCollectButton } from "@/modules/payment/ui/tonal-collect";
import { isForgivable } from "@/modules/payment/domain/units";
import type { PerPlayerResult } from "@/modules/booking/ui/action-types";
import { OtherAmountForm, OtherAmountToggle } from "@/modules/booking/ui/booking-sheet/other-amount";
import { CollectAdvance, type AdvanceStep } from "@/modules/booking/ui/booking-sheet/collect-advance";
import { giveBackText } from "@/lib/copy/helpers";

export type SlotView = {
  participantId: string;
  slotNumber: number;
  /** Null until the slot is named (slice 4). */
  name: string | null;
  /** formatUsd strings, Latin digits (whole pounds on an LBP game, see `PerPlayerView.currency`). */
  dueUsd: string;
  remainingUsd: string;
  paid: boolean;
  /** From `sharePayState`: covered = unpaid, but money already collected covers it. */
  state: "paid" | "pay" | "covered";
  /** What a tap charges (formatUsd). Null unless state is "pay". */
  chargeUsd: string | null;
  /** The tap charges less than the slot's remaining (the booking owes less). */
  partial: boolean;
};

export type PerPlayerView = {
  bookingId: string;
  /**
   * The game's currency (DR-007 slice 7). On "LBP" every amount of the view (the slots' `dueUsd`,
   * `remainingUsd` and `chargeUsd`, `unassignedUsd`, `unpaidTotalUsd`) is whole pounds ("285000"); on
   * "USD", or absent, it is dollars with cents. The field names are the dollar ones from before.
   */
  currency?: "USD" | "LBP";
  mode: "WHOLE" | "PER_PLAYER";
  /** APPROVED with something due: the only state that may switch mode. */
  canSplit: boolean;
  defaultPlayerCount: number;
  slots: SlotView[];
  unassignedUsd: string;
  hasAllocations: boolean;
  /** What "Booker pays all remaining" charges: `planShareCharge`, capped at the booking remaining. */
  unpaidTotalUsd: string;
};

/**
 * The slot list of a split game (SPEC-15 §3.2); the split switch itself is in More actions.
 * Actions do not redirect, so the sheet stays open across taps. Each tap is guarded
 * here per slot; the server also locks the booking, so a double tap pays once.
 * On a game in pounds (DR-007 slice 7) the amounts are pounds, a slot can take pounds and dollars
 * and a share left under one money unit can be marked paid. On a game in pounds "Other amount or currency"
 * opens the same form as the whole game (`OtherAmountForm`); a dollar share keeps its one exact-dollar Pay.
 */
export function PerPlayerCollect({
  view,
  mayCollect,
  advanceNeeded = false,
  locale,
  lbpPerUsd = null,
  submitCollectAllRemaining,
  submitCollectSlot,
  submitConsiderSharePaid,
}: {
  view: PerPlayerView;
  mayCollect: boolean;
  /** The game has not been played yet: the shares are paid only after "Collect in advance" is confirmed, and none is forgiven. */
  advanceNeeded?: boolean;
  locale: UiLocale;
  /** The current exchange rate, to tell which leftover is small enough to forgive and to show Give back. */
  lbpPerUsd?: string | null;
  submitCollectAllRemaining: (input: { bookingId: string }) => Promise<PerPlayerResult>;
  submitCollectSlot: (input: {
    bookingId: string;
    participantId: string;
    usdAmount?: string;
    lbpAmount?: string;
    keepChange?: boolean;
  }) => Promise<PerPlayerResult>;
  /** Absent: "Consider it paid" is not offered on a share. */
  submitConsiderSharePaid?: (input: { bookingId: string; participantId: string }) => Promise<PerPlayerResult>;
}) {
  const [advance, setAdvance] = useState<AdvanceStep>("idle");
  const [busy, setBusy] = useState<ReadonlySet<string>>(new Set());
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [cashOpen, setCashOpen] = useState<string | null>(null);

  const perPlayer = view.mode === "PER_PLAYER";
  const gated = advanceNeeded && advance !== "open";
  // Paying a share before the game is played goes through "Collect in advance"; forgiving never does.
  const mayPay = mayCollect && !gated;
  const inPounds = view.currency === "LBP";
  const rate = lbpPerUsd ? new Decimal(lbpPerUsd) : null;
  /** An amount of this view, written with its currency. */
  const money = (amount: string) => (inPounds ? formatLbpAmount(amount, locale) : dollars(amount));
  if (!perPlayer) return null;

  async function run(key: string, action: () => Promise<PerPlayerResult>) {
    if (busy.has(key)) return;
    setBusy((current) => new Set(current).add(key));
    setErrorKey(null);
    try {
      const result = await action();
      if ("error" in result) setErrorKey(result.error);
      else {
        setCashOpen(null);
        const change = result.kept
          ? giveBackText({ lbp: result.changeLbp ?? "0", usd: result.changeUsd ?? "0" }, locale, true)
          : changeDescription({ lbp: result.changeLbp ?? "0", usd: result.changeUsd ?? "0" }, locale, lbpPerUsd);
        if (change) toast.success(change, { duration: 8000 });
      }
    } catch {
      setErrorKey("error.generic");
    } finally {
      setBusy((current) => {
        const next = new Set(current);
        next.delete(key);
        return next;
      });
    }
  }

  const paidCount = view.slots.filter((slot) => slot.paid).length;
  const payAllOpen = new Decimal(view.unpaidTotalUsd).gt(0);

  return (
    <div className="flex flex-col gap-3">
      {perPlayer ? (
        <>
          <p className="text-sm text-muted-foreground">
            {paidOfLine(paidCount, view.slots.length, locale)}
          </p>
          {!new Decimal(view.unassignedUsd).isZero() ? (
            <p className="text-sm">
              {ui("owner.unassigned", locale)}{" "}
              <LtrIsolate>{money(view.unassignedUsd)}</LtrIsolate>
            </p>
          ) : null}
          {mayCollect && gated ? <CollectAdvance step={advance} onStep={setAdvance} locale={locale} /> : null}
          <ul className="flex flex-col gap-2">
            {view.slots.map((slot) => {
              const mayForgive =
                mayCollect &&
                !advanceNeeded &&
                !!submitConsiderSharePaid &&
                slot.state === "pay" &&
                !slot.partial &&
                isForgivable(new Decimal(slot.remainingUsd), inPounds ? "LBP" : "USD", rate);
              // Pounds only: a share of a dollar game is paid with its exact dollars, since the server records
              // the charge in dollars whatever is typed (`payInDollars` in collect-player-payment.ts).
              const mayPayOtherWay = inPounds && mayPay && slot.state === "pay";
              return (
                <li key={slot.participantId} className="rounded-lg bg-muted px-3 py-1">
                  <div className="flex items-center gap-3">
                    <span className="w-6 shrink-0 text-sm text-muted-foreground">
                      <LtrIsolate>{slot.slotNumber}</LtrIsolate>
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm">
                      {slot.name ?? playerLabel(slot.slotNumber, locale)}
                    </span>
                    <LtrIsolate className="text-sm">{money(slot.dueUsd)}</LtrIsolate>
                    {slot.paid ? (
                      <span
                        className={cn(
                          "inline-flex min-h-11 min-w-20 items-center justify-center gap-1 text-sm font-semibold text-paid",
                        )}
                      >
                        <Check aria-hidden className="size-4" />
                        {ui("owner.slotPaid", locale)}
                      </span>
                    ) : slot.state === "covered" ? (
                      <span className="inline-flex min-h-11 min-w-20 items-center justify-center text-center text-xs text-muted-foreground">
                        {ui("owner.slotCovered", locale)}
                      </span>
                    ) : mayPay ? (
                      <TonalCollectButton
                        disabled={busy.has(slot.participantId)}
                        onClick={() =>
                          void run(slot.participantId, () =>
                            submitCollectSlot({
                              bookingId: view.bookingId,
                              participantId: slot.participantId,
                            }),
                          )
                        }
                      >
                        {ui("owner.payPlayer", locale)}
                        {slot.partial && slot.chargeUsd ? (
                          <LtrIsolate> {money(slot.chargeUsd)}</LtrIsolate>
                        ) : null}
                      </TonalCollectButton>
                    ) : null}
                  </div>
                  {mayPayOtherWay ? (
                    <OtherAmountToggle
                      open={cashOpen === slot.participantId}
                      onToggle={() => setCashOpen((open) => (open === slot.participantId ? null : slot.participantId))}
                      locale={locale}
                    />
                  ) : null}
                  {mayPayOtherWay && cashOpen === slot.participantId ? (
                    <div className="pb-3">
                    <OtherAmountForm
                      id={`slot-${slot.participantId}`}
                      currency={inPounds ? "LBP" : "USD"}
                      remaining={slot.chargeUsd ?? slot.remainingUsd}
                      lbpPerUsd={lbpPerUsd}
                      locale={locale}
                      submit={{ kind: "callback", busy: busy.has(slot.participantId), onPay: (cash) =>
                        void run(slot.participantId, () =>
                          submitCollectSlot({
                            bookingId: view.bookingId,
                            participantId: slot.participantId,
                            lbpAmount: cash.lbpAmount,
                            usdAmount: cash.usdAmount,
                            keepChange: cash.keepChange,
                          }),
                        ) }}
                    />
                    </div>
                  ) : null}
                  {mayForgive ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="-ms-3 mb-1 min-h-11 rounded-full px-3 type-label text-muted-foreground"
                      disabled={busy.has(`forgive-${slot.participantId}`)}
                      onClick={() =>
                        void run(`forgive-${slot.participantId}`, () =>
                          submitConsiderSharePaid!({ bookingId: view.bookingId, participantId: slot.participantId }),
                        )
                      }
                    >
                      {ui("owner.considerPaid", locale)}
                    </Button>
                  ) : null}
                </li>
              );
            })}
          </ul>
          {mayPay && payAllOpen ? (
            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={busy.has("all")}
              onClick={() =>
                void run("all", () =>
                  submitCollectAllRemaining({ bookingId: view.bookingId }),
                )
              }
            >
              {bookerPaysAllLabel(money(view.unpaidTotalUsd), locale)}
            </Button>
          ) : null}
        </>
      ) : null}

      {errorKey ? (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage(errorKey, locale)}
        </p>
      ) : null}
    </div>
  );
}
