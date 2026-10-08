import * as React from "react"
import { cn } from "cn"

/** Phones, money, times and logins are always Latin: lay them out left to right. */
const LTR_TYPES = new Set(["tel", "number", "email", "password", "url", "time", "date"])
const LTR_INPUT_MODES = new Set(["numeric", "decimal", "tel", "email", "url"])

/**
 * Free text gets dir="auto" so an English name typed on an Arabic page keeps its own
 * order (punctuation, caret). Either way the text stays on the page's start edge in
 * RTL, so a column of fields lines up. A caller's `dir` wins.
 */
function inputDir(type: string | undefined, inputMode: string | undefined) {
  return LTR_TYPES.has(type ?? "") || LTR_INPUT_MODES.has(inputMode ?? "")
    ? "ltr"
    : "auto"
}

function Input({ className, type, dir, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      dir={dir ?? inputDir(type, props.inputMode)}
      data-slot="input"
      className={cn(
        "h-11 w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-1 type-field shadow-xs transition-[color,box-shadow] outline-none selection:bg-primary selection:text-primary-foreground file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30",
        "rtl:text-right",
        "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
        "aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    />
  )
}

export { Input }
