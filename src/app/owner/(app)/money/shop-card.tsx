import type Decimal from "decimal.js";
import { LtrIsolate } from "@/components/ui/ltr-isolate";
import type { UiLocale } from "@/lib/locale";
import { formatUsdCompact } from "@/lib/money";
import { ui } from "@/lib/ui-copy";
import type { ShopPeriodSummary } from "@/modules/shop/application/summarize-shop-period";

/**
 * The shop for the period: what was sold and what was spent on shop supplies, side by side. Never
 * a "profit": supplies are bought in lots, so a profit per period would mislead. The caption says
 * that sales also count items put on games that are not paid yet (a later slice).
 */
export function ShopCard({
  summary,
  suppliesUsd,
  locale,
}: {
  summary: ShopPeriodSummary;
  suppliesUsd: Decimal;
  locale: UiLocale;
}) {
  return (
    <section className="flex flex-col gap-3 rounded-xl border bg-card p-4">
      <h3 className="type-section">{ui("owner.shop", locale)}</h3>
      <div className="flex items-baseline justify-between gap-3">
        <span className="type-secondary">{ui("owner.shopSales", locale)}</span>
        <LtrIsolate className="type-strong">{`$${formatUsdCompact(summary.salesUsd)}`}</LtrIsolate>
      </div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="type-secondary">{ui("owner.shopSupplies", locale)}</span>
        <LtrIsolate className="type-strong">{`$${formatUsdCompact(suppliesUsd)}`}</LtrIsolate>
      </div>
      <p className="type-caption">{ui("owner.shopCaption", locale)}</p>
      {summary.items.length > 0 ? (
        <div className="flex flex-col gap-1">
          <p className="type-caption">{ui("owner.shopItems", locale)}</p>
          <ul className="overflow-hidden rounded-lg border">
            {summary.items.map((item) => (
              <li key={item.productId} className="flex items-center justify-between gap-3 border-b px-3 py-2 last:border-b-0">
                <span className="type-body min-w-0 truncate">
                  <bdi>{item.name}</bdi>
                </span>
                <span className="type-secondary shrink-0">
                  <LtrIsolate>{`${item.qty} · $${formatUsdCompact(item.totalUsd)}`}</LtrIsolate>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
