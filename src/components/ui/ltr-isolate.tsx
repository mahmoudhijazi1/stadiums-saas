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
