import Decimal from "decimal.js";
import { LtrIsolate } from "@/components/ui/ltr-isolate";
import { formatLbpAmount, formatUsdAmount } from "@/lib/format/money";
import type { UiLocale } from "@/lib/locale";
import { cn } from "cn";

/**
 * What is owed, exact, with each currency on its own line: pounds, then dollars, never added together
 * (DR-007). A currency that owes nothing is not shown. Each amount is an LTR isolate written the same
 * way in both languages (digits, then the unit), so the Arabic screen shows the same figures, not a
 * mirrored order. Shared by Today's To collect header, the Money tab's owed badge and the owed page.
 */
export function OwedAmounts({
  usd,
  lbp,
  locale,
  className,
}: {
  /** Dollars, exact ("30.00"). */
  usd: string;
  /** Pounds, exact ("2000000"). */
  lbp: string;
  locale: UiLocale;
  className?: string;
}) {
  const amounts: string[] = [];
  if (new Decimal(lbp).gt(0)) amounts.push(formatLbpAmount(lbp, locale));
  if (new Decimal(usd).gt(0)) amounts.push(formatUsdAmount(usd));
  return (
    <span className={cn("flex shrink-0 flex-col items-end leading-snug", className)}>
      {amounts.map((amount) => (
        <LtrIsolate key={amount} className="whitespace-nowrap">
          {amount}
        </LtrIsolate>
      ))}
    </span>
  );
}
