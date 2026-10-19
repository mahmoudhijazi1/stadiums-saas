"use client";

import { useState } from "react";
import Decimal from "decimal.js";
import { Check, ChevronDown } from "lucide-react";
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
import { formatLbpAmount } from "@/lib/format/money";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LbpInput } from "@/components/ui/lbp-input";
import { LtrIsolate } from "@/components/ui/ltr-isolate";
import { cn } from "cn";
import { TonalCollectButton } from "@/modules/payment/ui/tonal-collect";
import { isForgivable } from "@/modules/payment/domain/units";
import type { PerPlayerResult } from "@/modules/booking/ui/action-types";
import { LbpGameBalance } from "@/modules/booking/ui/booking-sheet/lbp-collect";
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
 * One slot's cash form on an LBP game: pounds (starting at the charge) and dollars, with the same live
 * line as the whole-game form (what the dollars cover, what is left, Give back). The server applies
 * the cash the same way, so what this shows is what will be recorded.
 */
function SlotCashForm({
  slot,
  lbpPerUsd,
  locale,
  busy,
  onPay,
}: {
  slot: SlotView;
  lbpPerUsd: string | null;
  locale: UiLocale;
  busy: boolean;
  onPay: (cash: { lbpAmount: string; usdAmount: string; keepChange: boolean }) => void;
}) {
  const charge = slot.chargeUsd ?? "0";
  const [lbp, setLbp] = useState(charge);
  const [usd, setUsd] = useState("");
  const [kept, setKept] = useState(false);
  return (
    <div className="flex flex-col gap-3 pb-3">
      <div className="flex flex-col gap-2">
        <Label htmlFor={`slot-lbp-${slot.participantId}`}>{ui("owner.lbp", locale)}</Label>
        <LbpInput id={`slot-lbp-${slot.participantId}`} value={lbp} onValueChange={setLbp} className="font-mono" />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`slot-usd-${slot.participantId}`}>USD</Label>
        <Input
          id={`slot-usd-${slot.participantId}`}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={usd}
          onChange={(event) => setUsd(event.target.value)}
          className="font-mono"
        />
      </div>
      <LbpGameBalance
        remainingLbp={new Decimal(charge)}
        usdText={usd}
        lbpText={lbp}
        lbpPerUsd={lbpPerUsd}
        locale={locale}
        kept={kept}
        onKeptChange={setKept}
      />
      <Button type="button" variant="outline" className="w-full" disabled={busy} onClick={() => onPay({ lbpAmount: lbp, usdAmount: usd, keepChange: kept })}>
        {ui("owner.collect", locale)}
      </Button>
    </div>
  );
}

/**
 * Mode switch + slot list for one booking (SPEC-15 §3.1, §3.2).
 * Actions do not redirect, so the sheet stays open across taps. Each tap is guarded
 * here per slot; the server also locks the booking, so a double tap pays once.
 * On a game in pounds (DR-007 slice 7) the amounts are pounds, a slot can take pounds and dollars
 * ("Pay another way", with Give back), and a share left under 5,000 LBP can be marked paid.
 */
export function PerPlayerCollect({
  view,
  part,
  mayCollect,
  mayAdjust,
  locale,
  lbpPerUsd = null,
  submitCollectAllRemaining,
  submitCollectSlot,
  submitConsiderSharePaid,
  submitSwitchToPerPlayer,
  submitSwitchToWhole,
}: {
  view: PerPlayerView;
  /** "slots": the players and their Pay buttons (the money block). "mode": the Whole / Per player switch (More actions). */
  part: "slots" | "mode";
  mayCollect: boolean;
  mayAdjust: boolean;
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
  submitSwitchToPerPlayer: (input: { bookingId: string; count: number }) => Promise<PerPlayerResult>;
  submitSwitchToWhole: (input: { bookingId: string }) => Promise<PerPlayerResult>;
}) {
  const [busy, setBusy] = useState<ReadonlySet<string>>(new Set());
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [splitOpen, setSplitOpen] = useState(false);
  const [cashOpen, setCashOpen] = useState<string | null>(null);
  const [count, setCount] = useState(String(view.defaultPlayerCount));

  const perPlayer = view.mode === "PER_PLAYER";
  const inPounds = view.currency === "LBP";
  const rate = lbpPerUsd ? new Decimal(lbpPerUsd) : null;
  /** An amount of this view, written with its currency. */
  const money = (amount: string) => (inPounds ? formatLbpAmount(amount, locale) : `$${amount}`);
  if (part === "slots" && !perPlayer) return null;
  if (part === "mode" && !(mayAdjust && (perPlayer || view.canSplit))) return null;

  async function run(key: string, action: () => Promise<PerPlayerResult>) {
    if (busy.has(key)) return;
    setBusy((current) => new Set(current).add(key));
    setErrorKey(null);
    try {
      const result = await action();
      if ("error" in result) setErrorKey(result.error);
      else {
        setSplitOpen(false);
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
  const locked = view.hasAllocations;

  return (
    <div className="flex flex-col gap-3">
      {part === "mode" ? (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold text-muted-foreground">
            {ui("owner.modeLabel", locale)}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="outline"
              className={cn(!perPlayer && "border-transparent bg-selected text-selected-ink")}
              aria-pressed={!perPlayer}
              disabled={busy.has("switch") || (perPlayer && locked)}
              onClick={() => {
                if (perPlayer) void run("switch", () => submitSwitchToWhole({ bookingId: view.bookingId }));
              }}
            >
              {ui("owner.modeWhole", locale)}
            </Button>
            <Button
              type="button"
              variant="outline"
              className={cn(perPlayer && "border-transparent bg-selected text-selected-ink")}
              aria-pressed={perPlayer}
              disabled={busy.has("switch")}
              onClick={() => {
                if (!perPlayer) setSplitOpen((open) => !open);
              }}
            >
              {ui("owner.modePerPlayer", locale)}
            </Button>
          </div>
          {perPlayer && locked ? (
            <p className="text-xs text-muted-foreground">
              {ui("owner.perPlayerLocked", locale)}
            </p>
          ) : null}
        </div>
      ) : null}

      {part === "mode" && !perPlayer && splitOpen ? (
        <div className="flex items-end gap-2">
          <div className="flex flex-1 flex-col gap-2">
            <Label htmlFor={`count-${view.bookingId}`}>
              {ui("owner.playerCount", locale)}
            </Label>
            <Input
              id={`count-${view.bookingId}`}
              type="number"
              min={1}
              max={30}
              step={1}
              inputMode="numeric"
              value={count}
              onChange={(event) => setCount(event.target.value)}
              className="font-mono"
            />
          </div>
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            disabled={busy.has("switch")}
            onClick={() =>
              void run("switch", () =>
                submitSwitchToPerPlayer({
                  bookingId: view.bookingId,
                  count: Number(count),
                }),
              )
            }
          >
            {ui("owner.splitConfirm", locale)}
          </Button>
        </div>
      ) : null}

      {part === "slots" && perPlayer ? (
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
          <ul className="flex flex-col gap-2">
            {view.slots.map((slot) => {
              const mayForgive =
                mayCollect &&
                !!submitConsiderSharePaid &&
                slot.state === "pay" &&
                !slot.partial &&
                isForgivable(new Decimal(slot.remainingUsd), inPounds ? "LBP" : "USD", rate);
              const mayPayOtherWay = inPounds && mayCollect && slot.state === "pay";
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
                    ) : mayCollect ? (
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
                    <button
                      type="button"
                      aria-expanded={cashOpen === slot.participantId}
                      onClick={() => setCashOpen((open) => (open === slot.participantId ? null : slot.participantId))}
                      className="-ms-3 inline-flex min-h-11 w-fit items-center gap-1 rounded-full px-3 type-label text-muted-foreground outline-none hover:bg-background hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
                    >
                      {cashOpen === slot.participantId ? ui("owner.hideCollectMixed", locale) : ui("owner.payAnotherWay", locale)}
                      <ChevronDown aria-hidden className={cn("size-4 shrink-0 transition-transform", cashOpen === slot.participantId && "rotate-180")} />
                    </button>
                  ) : null}
                  {mayPayOtherWay && cashOpen === slot.participantId ? (
                    <SlotCashForm
                      slot={slot}
                      lbpPerUsd={lbpPerUsd}
                      locale={locale}
                      busy={busy.has(slot.participantId)}
                      onPay={(cash) =>
                        void run(slot.participantId, () =>
                          submitCollectSlot({
                            bookingId: view.bookingId,
                            participantId: slot.participantId,
                            lbpAmount: cash.lbpAmount,
                            usdAmount: cash.usdAmount,
                            keepChange: cash.keepChange,
                          }),
                        )
                      }
                    />
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
          {mayCollect && payAllOpen ? (
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
