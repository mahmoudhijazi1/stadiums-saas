import { CircleAlert, CircleCheck } from "lucide-react";
import { LtrIsolate } from "@/components/ui/ltr-isolate";
import { cn } from "cn";

export type BookingTone = "paid" | "owed" | "expected";

const EDGE: Record<BookingTone, string> = {
  paid: "border-s-[color:var(--paid)]",
  owed: "border-s-[color:var(--owed)]",
  expected: "border-s-[color:var(--expected)]",
};
const INK: Record<BookingTone, string> = {
  paid: "text-paid",
  owed: "text-owed",
  expected: "text-expected",
};

/**
 * A booked slot. The whole card is the button. The name takes its own line and wraps,
 * never truncated. Status is colour token + label (+ icon); the amount says whose it is.
 */
export function BookingCard({
  name,
  tone,
  statusLabel,
  gameLabel,
  onSelect,
}: {
  name: string;
  tone: BookingTone;
  /** "Expected" / "Owed" / "Paid", translated. */
  statusLabel: string;
  /** "Game $30", translated. */
  gameLabel: string;
  onSelect: () => void;
}) {
  const Icon = tone === "paid" ? CircleCheck : tone === "owed" ? CircleAlert : null;
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex min-h-16 w-full cursor-pointer flex-col justify-center gap-1 rounded-xl border border-s-4 bg-card px-4 py-3 text-start outline-none",
        "focus-visible:ring-[3px] focus-visible:ring-ring/50",
        EDGE[tone],
      )}
    >
      <span dir="auto" className="text-base font-semibold break-words text-foreground">
        {name}
      </span>
      <span className="flex flex-wrap items-center gap-2 text-sm">
        <span className={cn("inline-flex items-center gap-1 font-medium", INK[tone])}>
          {Icon ? <Icon aria-hidden className="size-4 shrink-0" /> : null}
          {statusLabel}
        </span>
        <span aria-hidden className="text-muted-foreground">
          ·
        </span>
        <LtrIsolate className="text-muted-foreground">{gameLabel}</LtrIsolate>
      </span>
    </button>
  );
}
