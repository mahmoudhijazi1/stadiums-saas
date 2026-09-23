import type { ComponentProps } from "react"
import { cn } from "cn"

/**
 * The only page width. Phone stays within 520px; larger breakpoints
 * widen the column. Pages must not set their own max-width.
 */
function Container({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "mx-auto w-full max-w-[520px] px-4 md:max-w-3xl md:px-6 lg:max-w-5xl lg:px-8 xl:max-w-6xl",
        className,
      )}
      {...props}
    />
  )
}

export { Container }
