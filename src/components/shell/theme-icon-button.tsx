"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import type { UiLocale } from "@/lib/locale";
import { ui } from "@/lib/copy";
import { cn } from "cn";

/**
 * One round button that flips light and dark through next-themes (the same mechanism as the
 * Theme setting). Same look as the language control beside it: a 36px disc with the surface fill
 * and a line border, inside a 44px hit area. Both icons are in the markup and CSS shows the right
 * one (the moon in light, the sun in dark), so there is no mount gate and no flash.
 */
export function ThemeIconButton({ locale = "ar", className }: { locale?: UiLocale; className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <button
      type="button"
      aria-label={ui("theme.label", locale)}
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      className={cn("group grid size-11 shrink-0 place-items-center rounded-full outline-none", className)}
    >
      <span
        className={cn(
          "grid size-9 place-items-center rounded-full border border-line bg-surface text-ink",
          "group-hover:bg-surface-2 group-focus-visible:ring-[3px] group-focus-visible:ring-ring/50",
        )}
      >
        <Moon aria-hidden className="size-4 dark:hidden" />
        <Sun aria-hidden className="hidden size-4 dark:block" />
      </span>
    </button>
  );
}
