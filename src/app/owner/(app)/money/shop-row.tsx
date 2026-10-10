import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type Decimal from "decimal.js";
import { LtrIsolate } from "@/components/ui/ltr-isolate";
import type { UiLocale } from "@/lib/locale";
import { formatUsdCompact } from "@/lib/format/money";
import { shopRowLine } from "@/lib/ui-copy";
import type { CivilRange, PeriodKind } from "@/modules/ledger/domain/period";
import { periodChipLabel } from "./period-label";
import { shopHref } from "./query";

/** Whether the row shows: the period has shop sales or shop-supply expenses. */
export function showsShopRow(items: number, suppliesUsd: Decimal): boolean {
  return items > 0 || suppliesUsd.gt(0);
}

/**
 * One row for the shop: "Shop · sales $X this month ›". It opens the shop page of the same period.
 * Sales and supplies are never shown side by side here (supplies are bought in lots, so a
 * per-period comparison would mislead); the detail page has both.
 */
export function ShopRow({
  salesUsd,
  kind,
  range,
  view,
  locale,
}: {
  salesUsd: Decimal;
  kind: PeriodKind;
  range: CivilRange;
  view: "usd" | "lbp";
  locale: UiLocale;
}) {
  const name = periodChipLabel(kind, range, locale);
  const amount = `$${formatUsdCompact(salesUsd)}`;
  const [before = "", after = ""] = shopRowLine(kind, name, "{amount}", locale).split("{amount}");

  return (
    <Link
      href={shopHref({ period: kind, ...(kind === "custom" ? range : {}), view })}
      className="flex min-h-14 items-center gap-3 rounded-xl border bg-card px-4 py-3 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      <span className="type-body min-w-0 flex-1">
        {before}
        <LtrIsolate className="type-strong">{amount}</LtrIsolate>
        {after}
      </span>
      <ChevronRight aria-hidden className="size-4 shrink-0 rtl:rotate-180" />
    </Link>
  );
}
