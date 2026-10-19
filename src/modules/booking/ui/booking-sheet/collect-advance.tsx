"use client";

import { Button } from "@/components/ui/button";
import { ui } from "@/lib/copy";
import type { UiLocale } from "@/lib/locale";

/** "idle": the secondary button; "confirm": the question; "open": the normal collect screen. */
export type AdvanceStep = "idle" | "confirm" | "open";

/**
 * Collecting on a game that has not been played yet: a secondary "Collect in advance" (AR: تحصيل مسبق)
 * that asks "This game hasn't been played yet. Collect in advance?" before the normal collect screen
 * opens. The same control gates the whole-game collect and the per-player shares, in both currencies.
 * Warn, never block (RULE-9/10): confirming always opens the screen.
 */
export function CollectAdvance({
  step,
  onStep,
  locale,
}: {
  step: AdvanceStep;
  onStep: (step: AdvanceStep) => void;
  locale: UiLocale;
}) {
  if (step === "open") return null;
  if (step === "confirm") {
    return (
      <div role="group" aria-label={ui("owner.collectAdvance", locale)} className="flex flex-col gap-3 rounded-xl border bg-card p-3">
        <p className="type-body">{ui("owner.collectAdvanceConfirm", locale)}</p>
        <div className="flex gap-2">
          <Button type="button" className="min-h-11 flex-1" onClick={() => onStep("open")}>
            {ui("owner.collectAdvance", locale)}
          </Button>
          <Button type="button" variant="ghost" className="min-h-11" onClick={() => onStep("idle")}>
            {ui("owner.notNow", locale)}
          </Button>
        </div>
      </div>
    );
  }
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="min-h-11 w-fit rounded-full px-4 type-label"
      onClick={() => onStep("confirm")}
    >
      {ui("owner.collectAdvance", locale)}
    </Button>
  );
}
