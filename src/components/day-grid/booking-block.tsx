import { CircleAlert, CircleCheck } from "lucide-react";
import { LtrIsolate } from "@/components/ui/ltr-isolate";
import { cn } from "cn";

export type BookingTone = "paid" | "owed" | "expected";

const TONE: Record<BookingTone, string> = {
  paid: "border-paid bg-paid-subtle text-paid",
  owed: "border-owed bg-owed-subtle text-owed",
  expected: "border-expected bg-expected-subtle text-expected",
};

/**
 * One booking as a block that spans its duration. Presentational: the caller supplies
 * geometry (px) and already-translated labels. Status is colour token + label + icon.
 */
export function BookingBlock({
  name,
  tone,
  statusLabel,
  amountLabel,
  topPx,
  heightPx,
  onSelect,
}: {
  name: string;
  tone: BookingTone;
  /** "Paid" / "Owed" / "Expected", already translated. */
  statusLabel: string;
  /** "$30". */
  amountLabel: string;
  topPx: number;
  heightPx: number;
  onSelect: () => void;
}) {
  const Icon = tone === "paid" ? CircleCheck : tone === "owed" ? CircleAlert : null;
  return (
    <button
      type="button"
      onClick={onSelect}
      style={{ top: topPx, height: heightPx }}
      className={cn(
        "absolute inset-x-0 flex cursor-pointer flex-col gap-0.5 overflow-hidden rounded-md border-s-4 px-2 py-1 text-start outline-none",
        "focus-visible:ring-[3px] focus-visible:ring-ring/50",
        TONE[tone],
      )}
    >
      <span dir="auto" className="truncate text-xs font-semibold text-foreground">
        {name}
      </span>
      <span className="flex items-center gap-1 text-xs font-medium">
        {Icon ? <Icon aria-hidden className="size-3.5 shrink-0" /> : null}
        <span className="truncate">{statusLabel}</span>
        <LtrIsolate>{amountLabel}</LtrIsolate>
      </span>
    </button>
  );
}
