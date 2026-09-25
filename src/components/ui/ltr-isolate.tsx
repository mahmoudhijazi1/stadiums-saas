import type { ComponentProps } from "react"
import { cn } from "cn"

/**
 * Isolate a Latin run (times, phones, money, yyyy-mm-dd) inside dir="rtl".
 * Display face + tabular-nums for comparable numbers (docs/theme.md §3).
 * font-mono alone does not stop 16:00–17:00 from painting backwards.
 */
function LtrIsolate({ className, ...props }: ComponentProps<"bdi">) {
  return (
    <bdi
      dir="ltr"
      className={cn("font-display tabular-nums", className)}
      {...props}
    />
  )
}

export { LtrIsolate }

/** Wrap each digit run so Western numbers stay left-to-right inside Arabic. */
export function IsolatedDigits({ text }: { text: string }) {
  const parts = text.split(/(\d+%?)/)
  return parts.map((part, index) =>
    /^\d+%?$/.test(part) ? (
      <LtrIsolate key={index}>{part}</LtrIsolate>
    ) : (
      <span key={index}>{part}</span>
    ),
  )
}
