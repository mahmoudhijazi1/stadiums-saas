import { Plus } from "lucide-react";
import { cn } from "cn";

/** A free offered slot: a quiet dashed cell with a small "+". */
export function FreeCell({
  ariaLabel,
  topPx,
  heightPx,
  onSelect,
}: {
  /** "5:00 PM, Pitch A1": what the tap books. */
  ariaLabel: string;
  topPx: number;
  heightPx: number;
  /** Omit when the person may not book: the cell shows and does nothing. */
  onSelect?: () => void;
}) {
  const className = cn(
    "absolute inset-x-0 flex items-center justify-center rounded-md border border-dashed border-line-strong text-muted-foreground",
    onSelect &&
      "cursor-pointer outline-none hover:bg-muted/60 focus-visible:ring-[3px] focus-visible:ring-ring/50",
  );
  const style = { top: topPx, height: heightPx };
  if (!onSelect) {
    return (
      <span style={style} className={className} aria-label={ariaLabel} role="img">
        <Plus aria-hidden className="size-4" />
      </span>
    );
  }
  return (
    <button type="button" onClick={onSelect} style={style} className={className} aria-label={ariaLabel}>
      <Plus aria-hidden className="size-4" />
    </button>
  );
}
