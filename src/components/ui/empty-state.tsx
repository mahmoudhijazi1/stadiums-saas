import { cn } from "cn"

/**
 * "Nothing here" block. `compact` is the quiet form for list screens (Today, Requests): the owner
 * type roles instead of the display heading, so an empty day reads as a note, not a banner.
 */
function EmptyState({
  title,
  next,
  compact = false,
}: {
  title: string
  next: string
  compact?: boolean
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center rounded-[var(--radius-sheet)] border border-dashed border-line-strong text-center",
        compact ? "gap-1 px-4 py-6" : "gap-2 px-6 py-8",
      )}
    >
      <p className={compact ? "type-strong" : "font-display text-2xl leading-tight font-extrabold"}>{title}</p>
      <p className={compact ? "type-secondary" : "text-sm text-ink-muted"}>{next}</p>
    </div>
  )
}

export { EmptyState }
