"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import type { UiLocale } from "@/lib/locale";
import { errorMessage } from "@/lib/copy/errors";
import {
  bookerPaysAllLabel,
  paidOfLine,
  playerLabel,
  ui,
} from "@/lib/copy";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LtrIsolate } from "@/components/ui/ltr-isolate";
import { cn } from "cn";
import { TonalCollectButton } from "@/app/owner/tonal-collect";
import {
  submitCollectAllRemaining,
  submitCollectSlot,
  submitSwitchToPerPlayer,
  submitSwitchToWhole,
  type PerPlayerResult,
} from "./actions";

export type SlotView = {
  participantId: string;
  slotNumber: number;
  /** Null until the slot is named (slice 4). */
  name: string | null;
  /** formatUsd strings, Latin digits. */
  dueUsd: string;
  remainingUsd: string;
  paid: boolean;
  /** From `slotPayState`: covered = unpaid, but money already collected covers it. */
  state: "paid" | "pay" | "covered";
  /** What a tap charges (formatUsd). Null unless state is "pay". */
  chargeUsd: string | null;
  /** The tap charges less than the slot's remaining (the booking owes less). */
  partial: boolean;
};

export type PerPlayerView = {
  bookingId: string;
  mode: "WHOLE" | "PER_PLAYER";
  /** APPROVED with something due: the only state that may switch mode. */
  canSplit: boolean;
  defaultPlayerCount: number;
  slots: SlotView[];
  unassignedUsd: string;
  hasAllocations: boolean;
  /** What "Booker pays all remaining" charges: `planSlotCharge`, capped at the booking remaining. */
  unpaidTotalUsd: string;
};

/**
 * Mode switch + slot list for one booking (SPEC-15 §3.1, §3.2).
 * Actions do not redirect, so the sheet stays open across taps. Each tap is guarded
 * here per slot; the server also locks the booking, so a double tap pays once.
 */
export function PerPlayerCollect({
  view,
  part,
  mayCollect,
  mayAdjust,
  locale,
}: {
  view: PerPlayerView;
  /** "slots": the players and their Pay buttons (the money block). "mode": the Whole / Per player switch (More actions). */
  part: "slots" | "mode";
  mayCollect: boolean;
  mayAdjust: boolean;
  locale: UiLocale;
}) {
  const [busy, setBusy] = useState<ReadonlySet<string>>(new Set());
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [splitOpen, setSplitOpen] = useState(false);
  const [count, setCount] = useState(String(view.defaultPlayerCount));

  const perPlayer = view.mode === "PER_PLAYER";
  if (part === "slots" && !perPlayer) return null;
  if (part === "mode" && !(mayAdjust && (perPlayer || view.canSplit))) return null;

  async function run(key: string, action: () => Promise<PerPlayerResult>) {
    if (busy.has(key)) return;
    setBusy((current) => new Set(current).add(key));
    setErrorKey(null);
    try {
      const result = await action();
      if ("error" in result) setErrorKey(result.error);
      else setSplitOpen(false);
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
  const payAllOpen = view.unpaidTotalUsd !== "0.00";
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
          {view.unassignedUsd !== "0.00" ? (
            <p className="text-sm">
              {ui("owner.unassigned", locale)}{" "}
              <LtrIsolate>${view.unassignedUsd}</LtrIsolate>
            </p>
          ) : null}
          <ul className="flex flex-col gap-2">
            {view.slots.map((slot) => (
              <li
                key={slot.participantId}
                className="flex items-center gap-3 rounded-lg bg-muted px-3 py-1"
              >
                <span className="w-6 shrink-0 text-sm text-muted-foreground">
                  <LtrIsolate>{slot.slotNumber}</LtrIsolate>
                </span>
                <span className="min-w-0 flex-1 truncate text-sm">
                  {slot.name ?? playerLabel(slot.slotNumber, locale)}
                </span>
                <LtrIsolate className="text-sm">${slot.dueUsd}</LtrIsolate>
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
                      <LtrIsolate> ${slot.chargeUsd}</LtrIsolate>
                    ) : null}
                  </TonalCollectButton>
                ) : null}
              </li>
            ))}
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
              {bookerPaysAllLabel(view.unpaidTotalUsd, locale)}
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
