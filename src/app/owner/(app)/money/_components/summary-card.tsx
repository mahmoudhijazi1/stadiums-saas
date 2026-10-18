import Link from "next/link";
import Decimal from "decimal.js";
import { Figure } from "@/components/ui/figure";
import { LtrIsolate } from "@/components/ui/ltr-isolate";
import type { UiLocale } from "@/lib/locale";
import { formatUsdCompact } from "@/lib/format/money";
import { groupDigits } from "@/lib/format/money";
import { comparisonLine, profitHeadline, ui } from "@/lib/copy";
import type { LedgerPeriodSummary } from "@/modules/ledger/application/summarize-ledger-period";
import type { LbpPeriodSummary } from "@/modules/payment/application/summarize-lbp-period";
import { isCalendarMonth, previousRange, type PeriodKind } from "@/modules/ledger/domain/period";
import { usdToDisplayLbp } from "@/modules/ledger/domain/totals";
import { sourceName } from "@/app/owner/(app)/money/_components/activity-map";
import { comparedWithLabel, periodChipLabel, rangeLabel } from "@/modules/ledger/ui/period-label";
import { activityHref } from "@/app/owner/(app)/money/query";

function amountText(amountUsd: Decimal, lbpPerUsd: Decimal | null): string {
  if (lbpPerUsd) {
    return `${groupDigits(usdToDisplayLbp(amountUsd.abs(), lbpPerUsd))} LBP`;
  }
  return `$${formatUsdCompact(amountUsd.abs())}`;
}

/** The sources that brought money IN, biggest first. The source line shows only with two or more. */
export function inSourceParts(summary: Pick<LedgerPeriodSummary, "inBySource">) {
  return summary.inBySource.filter((source) => source.usd.gt(0));
}

/** Whether the comparison line is shown: only when the period before has at least one ledger row. */
export function showsComparison(summary: Pick<LedgerPeriodSummary, "previous">): boolean {
  return summary.previous !== undefined && summary.previous.rows > 0;
}

/**
 * One summary card for the period: profit (or loss, in a neutral colour) as the one big figure; a
 * comparison line only when the period before has at least one ledger row; "In $X · Out $Y" where
 * each part opens the activity filtered; and one muted line splitting In by source, hidden when
 * there is a single source. All from the existing ledger sums, in USD (or the LBP view).
 */
export function SummaryCard({
  summary,
  kind,
  view,
  lbpPerUsd,
  lbp,
  locale,
}: {
  summary: LedgerPeriodSummary;
  kind: PeriodKind;
  view: "usd" | "lbp";
  /** The rate used when the LBP view is on; null shows dollars. */
  lbpPerUsd: Decimal | null;
  /** The LBP view's figures, each payment at its own value; when set (and view is lbp) they replace the dollars. */
  lbp?: LbpPeriodSummary | null;
  locale: UiLocale;
}) {
  const range = { from: summary.from, to: summary.to };
  const pounds = view === "lbp" && lbp ? lbp : null;
  const loss = (pounds ? pounds.netLbp : summary.netUsd).isNegative();
  const chip = periodChipLabel(kind, range, locale);
  const name = kind === "custom" && !isCalendarMonth(range) ? rangeLabel(range, locale) : chip;
  const conversion = view === "lbp" ? lbpPerUsd : null;
  const customRange = kind === "custom" ? { from: summary.from, to: summary.to } : {};

  const previous = summary.previous;
  const delta = pounds
    ? pounds.previous && pounds.previous.payments > 0
      ? pounds.netLbp.minus(pounds.previous.netLbp)
      : null
    : previous && showsComparison(summary)
      ? summary.netUsd.minus(previous.netUsd)
      : null;
  const text = (value: Decimal) => (pounds ? `${groupDigits(value.abs())} LBP` : amountText(value, conversion));
  const against = comparedWithLabel(range, previousRange(range), locale);
  const sources = pounds
    ? pounds.inBySource.filter((source) => source.lbp.gt(0)).map((source) => ({ sourceType: source.sourceType, usd: source.lbp }))
    : inSourceParts(summary);

  return (
    <section className="flex flex-col gap-2 rounded-xl border bg-card p-4">
      <p className="type-section">{profitHeadline(kind, name, loss, locale)}</p>
      <Figure className="block text-4xl">{text(pounds ? pounds.netLbp : summary.netUsd)}</Figure>
      {pounds ? (
        <p className="type-caption text-muted-foreground">
          {ui("owner.lbpAtDayRate", locale)}
          {pounds.unrated > 0 ? ` · ${ui("owner.lbpUnrated", locale).replace("{n}", String(pounds.unrated))}` : ""}
        </p>
      ) : null}
      {delta ? (
        <p className="type-secondary">
          {comparisonLine(
            delta.isZero() ? "same" : delta.isPositive() ? "up" : "down",
            text(delta),
            against,
            locale,
          )}
        </p>
      ) : null}

      <p className="type-body flex flex-wrap gap-x-2">
        <Link
          href={activityHref({ period: kind, ...customRange, view, filter: "in" })}
          className="inline-flex min-h-11 items-center gap-1 rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <span>{ui("owner.in", locale)}</span>
          <LtrIsolate className="type-strong text-paid">{text(pounds ? pounds.inLbp : summary.inUsd)}</LtrIsolate>
        </Link>
        <span aria-hidden className="inline-flex items-center">
          ·
        </span>
        <Link
          href={activityHref({ period: kind, ...customRange, view, filter: "out" })}
          className="inline-flex min-h-11 items-center gap-1 rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <span>{ui("owner.out", locale)}</span>
          <LtrIsolate className="type-strong">{text(pounds ? pounds.outLbp : summary.outUsd)}</LtrIsolate>
        </Link>
      </p>

      {sources.length > 1 ? (
        <p className="type-secondary text-muted-foreground">
          {sources.map((source, index) => (
            <span key={source.sourceType}>
              {index > 0 ? <span aria-hidden> · </span> : null}
              {sourceName(source.sourceType, locale)} <LtrIsolate>{text(source.usd)}</LtrIsolate>
            </span>
          ))}
        </p>
      ) : null}
    </section>
  );
}
