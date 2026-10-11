"use client";

import { useEffect } from "react";
import { useTheme } from "next-themes";
import { applyThemeColor } from "@/lib/theme-color";

/**
 * Keeps the system bars (status bar, browser bars) the colour of the app theme in use, including
 * when the owner forces light or dark against the phone's setting, and when the theme changes while
 * the app is open. Renders nothing.
 */
export function SystemBars() {
  const { resolvedTheme } = useTheme();
  useEffect(() => {
    if (resolvedTheme === "light" || resolvedTheme === "dark") applyThemeColor(document, resolvedTheme);
  }, [resolvedTheme]);
  return null;
}
