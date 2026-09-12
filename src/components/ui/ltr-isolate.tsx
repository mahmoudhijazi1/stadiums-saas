import type { ComponentProps } from "react"
import { cn } from "cn"

/**
 * Isolate a Latin run (times, phones, money, yyyy-mm-dd) inside dir="rtl".
 * font-mono alone does not stop 16:00–17:00 from painting backwards.
 */
function LtrIsolate({ className, ...props }: ComponentProps<"bdi">) {
  return <bdi dir="ltr" className={cn("font-mono", className)} {...props} />
}

export { LtrIsolate }
