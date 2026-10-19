"use client";

import { Button } from "@/components/ui/button";
import { ui } from "@/lib/copy";
import type { UiLocale } from "@/lib/locale";
import { cn } from "cn";

/**
 * "Keep it" (DR-007 decision 15): a small secondary control next to "Give back". Pressed, the change
 * is recorded as the stadium's (its own kept-change payment) and the line says "Kept". Games only.
 */
export function KeepItButton({
  kept,
  onChange,
  locale,
}: {
  kept: boolean;
  onChange: (kept: boolean) => void;
  locale: UiLocale;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      aria-pressed={kept}
      className={cn("min-h-11 shrink-0 rounded-full px-3 type-label", kept && "border-transparent bg-selected text-selected-ink")}
      onClick={() => onChange(!kept)}
    >
      {ui("owner.keepIt", locale)}
    </Button>
  );
}
