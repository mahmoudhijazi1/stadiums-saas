import { Plus } from "lucide-react";
import { LtrIsolate } from "@/components/ui/ltr-isolate";
import { cn } from "cn";

/**
 * A free slot: a quiet dashed row with "+ Book". Shows a price only when it differs from
 * the pitch default, and a count badge when requests are pending. Inert without `onSelect`.
 */
export function FreeRow({
  bookLabel,
  ariaLabel,
  priceLabel,
  pending,
  pendingLabel,
  onSelect,
}: {
  /** "Book", translated. */
  bookLabel: string;
  /** "7:00 PM Pitch A1": what the tap books. */
  ariaLabel: string;
  /** "$40" when it differs from the pitch default, else null. */
  priceLabel: string | null;
  pending: number;
  /** "2 requests", translated (screen readers). */
  pendingLabel: string;
  onSelect?: () => void;
}) {
  const className = cn(
    "flex min-h-12 w-full items-center gap-2 rounded-xl border border-dashed border-line-strong px-4 text-start text-sm text-muted-foreground",
    onSelect &&
      "cursor-pointer outline-none hover:bg-muted/60 focus-visible:ring-[3px] focus-visible:ring-ring/50",
  );
  const face = (
    <>
      <Plus aria-hidden className="size-4 shrink-0" />
      <span className="font-medium">{bookLabel}</span>
      {priceLabel ? <LtrIsolate>{priceLabel}</LtrIsolate> : null}
      {pending > 0 ? (
        <span
          title={pendingLabel}
          className="ms-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-action-ink px-1.5 text-xs font-semibold text-background"
        >
          <LtrIsolate>{pending}</LtrIsolate>
          <span className="sr-only">{pendingLabel}</span>
        </span>
      ) : null}
    </>
  );
  if (!onSelect) {
    return <div className={className}>{face}</div>;
  }
  return (
    <button type="button" onClick={onSelect} aria-label={ariaLabel} className={className}>
      {face}
    </button>
  );
}
