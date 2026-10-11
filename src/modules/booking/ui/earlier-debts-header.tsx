import { ChevronDown, CircleAlert } from "lucide-react";
import { cn } from "cn";
import { ui } from "@/lib/copy";
import type { UiLocale } from "@/lib/locale";
import { LtrIsolate } from "@/components/ui/ltr-isolate";

const rowClass =
  "flex min-h-11 w-full items-center gap-3 rounded-lg border border-owed/60 bg-owed-subtle px-3 py-2 text-start text-sm font-semibold text-owed";

/**
 * The one place Today shows money owed from earlier days: alert icon, "To collect", the total, "from
 * earlier days". The total is the capped list's sum, so with more rows behind it the amount reads
 * "at least $X" rather than a bare "+". With several rows the header is the toggle (chevron); with
 * one the row is shown and the header is plain.
 */
export function EarlierDebtsHeader({
  total,
  hasMore,
  locale,
  expandable,
  expanded,
  onToggle,
}: {
  total: string;
  hasMore: boolean;
  locale: UiLocale;
  expandable: boolean;
  expanded: boolean;
  onToggle: () => void;
}) {
  const amount = <LtrIsolate>{`$${total}`}</LtrIsolate>;
  const content = (
    <>
      <CircleAlert aria-hidden className="size-5 shrink-0" />
      <span className="min-w-0 flex-1">
        <span id="earlier-debts-heading">{ui("owner.toCollect", locale)}</span>
        <span aria-hidden> · </span>
        {hasMore ? (
          <>
            {ui("owner.owedAtLeast", locale).split("{amount}")[0]}
            {amount}
            {ui("owner.owedAtLeast", locale).split("{amount}")[1]}
          </>
        ) : (
          amount
        )}
        <span aria-hidden> · </span>
        {ui("owner.owedFromEarlier", locale)}
      </span>
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
