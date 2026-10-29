"use client";

import { useState } from "react";
import { Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ui } from "@/lib/copy";
import { errorMessage } from "@/lib/copy/errors";
import type { UiLocale } from "@/lib/locale";
import { cn } from "cn";
import type { PerPlayerResult } from "@/modules/booking/ui/action-types";
import type { PerPlayerView } from "@/modules/booking/ui/per-player-collect";

/**
 * "Split between players" (AR: تقسيم على اللاعبين) in More actions: one switch row instead of the old
 * "Collection method: whole | per player" segment, the same two actions. Turning it on asks how many
 * players, then splits; turning it off goes back to the whole booking. Once a share has a payment the
 * switch stays on and says why (`owner.perPlayerLocked`).
 */
export function SplitSwitchRow({
  view,
  locale,
  submitSwitchToPerPlayer,
  submitSwitchToWhole,
  initialAsking = false,
}: {
  view: PerPlayerView;
  locale: UiLocale;
  submitSwitchToPerPlayer: (input: { bookingId: string; count: number }) => Promise<PerPlayerResult>;
  submitSwitchToWhole: (input: { bookingId: string }) => Promise<PerPlayerResult>;
  /** Opened from the quick tile: ask how many players straight away. */
  initialAsking?: boolean;
}) {
  const on = view.mode === "PER_PLAYER";
  const locked = on && view.hasAllocations;
  const [asking, setAsking] = useState(initialAsking);
  const [count, setCount] = useState(String(view.defaultPlayerCount));
  const [busy, setBusy] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  async function run(action: () => Promise<PerPlayerResult>) {
    if (busy) return;
    setBusy(true);
    setErrorKey(null);
    try {
      const result = await action();
      if ("error" in result) setErrorKey(result.error);
      else setAsking(false);
    } catch {
      setErrorKey("error.generic");
    } finally {
      setBusy(false);
    }
  }

  function toggle() {
    if (on) void run(() => submitSwitchToWhole({ bookingId: view.bookingId }));
    else setAsking((open) => !open);
  }

  const checked = on || asking;
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={busy || locked}
        onClick={toggle}
        className="flex min-h-14 w-full items-center gap-3 px-4 type-body text-start outline-none hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-inset focus-visible:ring-ring/50 disabled:opacity-60"
      >
        <Users aria-hidden className="size-5 shrink-0" />
        <span className="flex min-w-0 flex-1 flex-col">
          {ui("owner.splitPlayers", locale)}
          {locked ? <span className="type-caption">{ui("owner.perPlayerLocked", locale)}</span> : null}
        </span>
        {/* The switch: the track fills and the knob moves to the end side when on. */}
        <span
          aria-hidden
          className={cn(
            "relative inline-flex h-6 w-10 shrink-0 items-center rounded-full border transition-colors",
            checked ? "border-transparent bg-selected" : "border-line-strong bg-surface-2",
          )}
        >
          <span
            className={cn(
              "absolute top-1/2 size-4 -translate-y-1/2 rounded-full transition-[inset-inline-start] motion-reduce:transition-none",
              checked ? "start-[calc(100%-1.25rem)] bg-selected-ink" : "start-0.5 bg-muted-foreground",
            )}
          />
        </span>
      </button>
      {asking && !on ? (
        <div className="flex items-end gap-2 px-4 pb-3 ps-12">
          <div className="flex flex-1 flex-col gap-2">
            <Label htmlFor={`count-${view.bookingId}`}>{ui("owner.playerCount", locale)}</Label>
            <Input
              id={`count-${view.bookingId}`}
              type="number"
              min={1}
              max={30}
              step={1}
              inputMode="numeric"
              dir="ltr"
              value={count}
              onChange={(event) => setCount(event.target.value)}
            />
          </div>
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            disabled={busy}
            onClick={() => void run(() => submitSwitchToPerPlayer({ bookingId: view.bookingId, count: Number(count) }))}
          >
            {ui("owner.splitConfirm", locale)}
          </Button>
        </div>
      ) : null}
      {errorKey ? (
        <p role="alert" className="px-4 pb-3 type-secondary text-destructive">
          {errorMessage(errorKey, locale)}
        </p>
      ) : null}
    </div>
  );
}
