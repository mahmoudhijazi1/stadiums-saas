import Link from "next/link";
import type { UiLocale } from "@/lib/locale";
import { type PeriodKind } from "@/modules/ledger/domain/period";
import { cn } from "cn";
import { PeriodSheet } from "./period-sheet";
import { periodChipLabel } from "./period-label";
import { moneyHref } from "./query";

/**
 * The top of Money, unchanged from before: the period chip and, when a rate is known, the
 * $ / LBP display toggle.
 */
export function PeriodBar({
  kind,
  from,
  to,
  view,
  rateKnown,
  locale,
}: {
  kind: PeriodKind;
  from: string;
  to: string;
  view: "usd" | "lbp";
  /** A rate exists (set or typed): the toggle is shown. */
  rateKnown: boolean;
  locale: UiLocale;
}) {
  const chip = periodChipLabel(kind, { from, to }, locale);
  const customRange = kind === "custom" ? { from, to } : {};

  return (
    <div className="flex items-center justify-between gap-3">
      <PeriodSheet label={chip} kind={kind} from={from} to={to} view={view} locale={locale} />
      {rateKnown ? (
        <div role="group" className="inline-flex rounded-full border bg-card p-0.5">
          {(["usd", "lbp"] as const).map((choice) => (
            <Link
              key={choice}
              href={moneyHref({ period: kind, ...customRange, view: choice })}
              aria-current={view === choice ? "true" : undefined}
              className={cn(
                "inline-flex min-h-10 min-w-12 items-center justify-center rounded-full px-3 type-label outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
                view === choice ? "bg-selected text-selected-ink" : "text-muted-foreground",
              )}
            >
              {choice === "usd" ? "$" : "LBP"}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
