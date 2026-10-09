"use client";

import type { ComponentProps } from "react";
import { cn } from "cn";

/**
 * The tonal "Collect" button: owed colours, a 36px pill inside a 44px hit area. The same style as
 * the earlier-debts row. Never the lime fill, which belongs to the one primary action of a sheet.
 * `expected` is the neutral look for money that is not owed yet (the game has not ended): ink on a
 * bordered surface, never a faded tint, so it still reads as a button you can press.
 */
export function TonalCollectButton({
  className,
  children,
  tone = "owed",
  ...props
}: ComponentProps<"button"> & { tone?: "owed" | "expected" }) {
  return (
    <button
      type="button"
      {...props}
      className={cn(
        "inline-flex min-h-11 shrink-0 items-center outline-none focus-visible:[&>span]:ring-[3px] focus-visible:[&>span]:ring-ring/50 disabled:opacity-60",
        className,
      )}
    >
      <span
        className={cn(
          "inline-flex h-9 items-center gap-1 rounded-full px-4 type-button whitespace-nowrap",
          tone === "owed"
            ? "bg-owed-subtle text-owed"
            : // Not owed yet: still an action, so full-contrast ink on a bordered surface (the muted
              // expected tint read as disabled).
              "border border-line-strong bg-surface-2 text-foreground",
        )}
      >
        {children}
      </span>
    </button>
  );
}
