import type { ComponentProps } from "react"
import { cn } from "cn"
import { LtrIsolate } from "@/components/ui/ltr-isolate"

/**
 * The single biggest figure on a screen (docs/ui-rules.md rule 7): display face,
 * tabular, LTR-isolated. One per screen. Every other number is body type.
 */
export function Figure({ className, ...props }: ComponentProps<"bdi">) {
  return (
    <LtrIsolate
      className={cn("font-display font-extrabold tabular-nums", className)}
      {...props}
    />
  )
}
