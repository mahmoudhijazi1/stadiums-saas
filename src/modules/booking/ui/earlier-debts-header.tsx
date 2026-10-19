import { ChevronDown, CircleAlert } from "lucide-react";
import { cn } from "cn";
import { ui } from "@/lib/copy";
import type { UiLocale } from "@/lib/locale";
import { OwedAmounts } from "@/modules/booking/ui/owed-amounts";

const rowClass =
  "flex min-h-11 w-full items-center gap-3 rounded-lg border bg-card px-3 py-2 text-start text-sm font-semibold text-foreground";

/**
 * The one place Today shows money owed from earlier days: a neutral surface, amber only on the alert icon and the amounts, "To collect" over "from earlier
 * days", and the EXACT amount owed by all of them, never "at least". Each currency has its own line,
 * pounds then dollars, never added together (DR-007); a currency that owes nothing is not shown. Every
 * amount is an LTR isolate written the same way in both languages (digits, then the unit), so the
 * Arabic screen shows the same figures, not a mirrored order. With several rows the header is the
 * toggle (chevron); with one the row is shown and the header is plain.
 */
export function EarlierDebtsHeader({
  usd,
  lbp,
  locale,
  expandable,
  expanded,
  onToggle,
}: {
  /** Dollars owed by all earlier-day games, exact ("30.00"). */
  usd: string;
  /** Pounds owed by all earlier-day games, exact ("2000000"). */
  lbp: string;
  locale: UiLocale;
  expandable: boolean;
  expanded: boolean;
  onToggle: () => void;
}) {
  const content = (
    <>
      <CircleAlert aria-hidden className="size-5 shrink-0 text-owed" />
      <span className="flex min-w-0 flex-1 flex-col leading-snug">
        <span id="earlier-debts-heading">{ui("owner.toCollect", locale)}</span>
        <span className="text-xs font-medium opacity-80">{ui("owner.owedFromEarlier", locale)}</span>
      </span>
      <OwedAmounts usd={usd} lbp={lbp} locale={locale} className="text-owed" />
    </>
  );
  if (!expandable) return <div className={rowClass}>{content}</div>;
  return (
    <button
      type="button"
      aria-expanded={expanded}
      aria-controls="to-collect-list"
      onClick={onToggle}
      className={cn(rowClass, "cursor-pointer outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50")}
    >
      {content}
      <ChevronDown aria-hidden className={cn("size-5 shrink-0 transition-transform", expanded && "rotate-180")} />
    </button>
  );
}
