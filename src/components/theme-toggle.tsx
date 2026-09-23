"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { cn } from "cn";
import type { UiLocale } from "@/lib/locale";
import { ui } from "@/lib/ui-copy";

type ThemeChoice = "light" | "dark" | "system";

const CHOICES: ThemeChoice[] = ["light", "dark", "system"];

/**
 * Light / dark / system. Mount-gated so SSR does not guess the stored theme.
 * Selected segment is a full fill swap (`--selected`), not a ring.
 */
export function ThemeToggle({
  locale = "ar",
  className,
}: {
  locale?: UiLocale;
  className?: string;
}) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const current: ThemeChoice =
    theme === "light" || theme === "dark" || theme === "system"
      ? theme
      : "system";

  return (
    <div
      role="group"
      aria-label={ui("theme.label", locale)}
      className={cn(
        "inline-flex gap-1 rounded-[var(--radius-control)] bg-surface-2 p-1",
        className,
      )}
    >
      {CHOICES.map((choice) => {
        const selected = mounted && current === choice;
        return (
          <button
            key={choice}
            type="button"
            aria-pressed={selected}
            disabled={!mounted}
            onClick={() => setTheme(choice)}
            className={cn(
              "min-h-11 min-w-11 rounded-[var(--radius-control)] px-3 text-sm font-medium outline-none",
              "transition-[background-color,color] duration-150 ease-out",
              "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              "motion-reduce:transition-none",
              selected
                ? "bg-selected text-selected-ink"
                : "bg-transparent text-ink-muted hover:text-ink",
            )}
          >
            {ui(`theme.${choice}`, locale)}
          </button>
        );
      })}
    </div>
  );
}
