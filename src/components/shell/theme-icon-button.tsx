"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import type { UiLocale } from "@/lib/locale";
import { ui } from "@/lib/copy";
import { cn } from "cn";

/**
 * One round button that flips light and dark through next-themes (the same mechanism as the
 * Theme setting). Both icons are in the markup and CSS shows the right one (the moon in light, the
 * sun in dark), so there is no mount gate and no flash. 44px.
 */
export function ThemeIconButton({ locale = "ar", className }: { locale?: UiLocale; className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <button
      type="button"
      aria-label={ui("theme.label", locale)}
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      className={cn(
        "grid size-11 shrink-0 place-items-center rounded-full text-ink outline-none hover:bg-surface-2",
        "focus-visible:ring-[3px] focus-visible:ring-ring/50",
        className,
      )}
    >
      <Moon aria-hidden className="size-5 dark:hidden" />
      <Sun aria-hidden className="hidden size-5 dark:block" />
    </button>
  );
}
