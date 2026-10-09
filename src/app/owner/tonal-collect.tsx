"use client";

import type { ComponentProps } from "react";
import { cn } from "cn";

/**
 * The tonal "Collect" button: owed colours, a 36px pill inside a 44px hit area. The same style as
 * the earlier-debts row. Never the lime fill, which belongs to the one primary action of a sheet.
 */
export function TonalCollectButton({ className, children, ...props }: ComponentProps<"button">) {
  return (
    <button
      type="button"
      {...props}
      className={cn(
        "inline-flex min-h-11 shrink-0 items-center outline-none focus-visible:[&>span]:ring-[3px] focus-visible:[&>span]:ring-ring/50 disabled:opacity-60",
        className,
      )}
    >
      <span className="inline-flex h-9 items-center gap-1 rounded-full bg-owed-subtle px-4 type-button text-owed whitespace-nowrap">
        {children}
      </span>
    </button>
  );
}
