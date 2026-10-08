import Link from "next/link";
import Decimal from "decimal.js";
import { Figure } from "@/components/ui/figure";
import { LtrIsolate } from "@/components/ui/ltr-isolate";
import type { UiLocale } from "@/lib/locale";
import { formatUsdCompact } from "@/lib/money";
import { comparisonLine, profitHeadline, ui } from "@/lib/ui-copy";
import type { LedgerPeriodSummary } from "@/modules/ledger/application/summarize-ledger-period";
import {
  isCalendarMonth,
  previousRange,
  type PeriodKind,
} from "@/modules/ledger/domain/period";
import { usdToDisplayLbp } from "@/modules/ledger/domain/totals";
import { cn } from "cn";
import { PeriodSheet } from "./period-sheet";
import { comparedWithLabel, periodChipLabel, rangeLabel } from "./period-label";
import { moneyHref } from "./query";

function amountText(amountUsd: Decimal, lbpPerUsd: Decimal | null): string {
  if (lbpPerUsd) {
    const lbp = usdToDisplayLbp(amountUsd.abs(), lbpPerUsd);
    return `${lbp.toFixed(0)} LBP`;
  }
  return `$${formatUsdCompact(amountUsd.abs())}`;
}

/**
 * The top of Money: the period chip, the $ / LBP display toggle (only when a rate is
 * known), one big figure (profit, or loss in a neutral colour), In and Out under it, and
 * one neutral comparison line against the period before. All from the existing ledger sums.
 */
export function MoneyHeadline({
  summary,
  kind,
  view,
  lbpPerUsd,
  rateKnown,
  locale,
}: {
  summary: LedgerPeriodSummary;
  kind: PeriodKind;
  view: "usd" | "lbp";
  /** The rate used when the LBP view is on; null shows dollars. */
  lbpPerUsd: Decimal | null;
  /** A rate exists (set or typed): the toggle is shown. */
  rateKnown: boolean;
  locale: UiLocale;
}) {
  const range = { from: summary.from, to: summary.to };
  const loss = summary.netUsd.isNegative();
  const chip = periodChipLabel(kind, range, locale);
  const name = kind === "custom" && !isCalendarMonth(range) ? rangeLabel(range, locale) : chip;
  const conversion = view === "lbp" ? lbpPerUsd : null;

  const previous = summary.previous;
  const delta = previous ? summary.netUsd.minus(previous.netUsd) : null;
  const against = comparedWithLabel(range, previousRange(range), locale);
  const customRange = kind === "custom" ? { from: summary.from, to: summary.to } : {};

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <PeriodSheet label={chip} kind={kind} from={summary.from} to={summary.to} view={view} locale={locale} />
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

      <div className="flex flex-col gap-1">
        <p className="type-section">{profitHeadline(kind, name, loss, locale)}</p>
        <Figure className="block text-4xl">{amountText(summary.netUsd, conversion)}</Figure>
        {delta ? (
          <p className="type-secondary">
            {comparisonLine(
              delta.isZero() ? "same" : delta.isPositive() ? "up" : "down",
              amountText(delta, conversion),
              against,
              locale,
            )}
          </p>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Link
          href={`${moneyHref({ period: kind, ...customRange, view, filter: "in" })}#activity`}
          className="rounded-xl bg-paid-subtle px-3 py-2 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <p className="type-caption text-paid">{ui("owner.in", locale)}</p>
          <p className="type-strong text-paid">
            <LtrIsolate>{amountText(summary.inUsd, conversion)}</LtrIsolate>
          </p>
        </Link>
        <Link
          href={`${moneyHref({ period: kind, ...customRange, view, filter: "out" })}#activity`}
          className="rounded-xl bg-muted px-3 py-2 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <p className="type-caption">{ui("owner.out", locale)}</p>
          <p className="type-strong">
            <LtrIsolate>{amountText(summary.outUsd, conversion)}</LtrIsolate>
          </p>
        </Link>
      </div>
    </section>
  );
}
