import Decimal from "decimal.js";
import { OwnerBackLink } from "@/app/owner/back-link";
import { requireOwnerMembership } from "@/app/owner/shared";
import { EmptyState } from "@/components/ui/empty-state";
import { LtrIsolate } from "@/components/ui/ltr-isolate";
import { getUiLocale } from "@/lib/get-ui-locale";
import { formatUsdCompact } from "@/lib/format/money";
import { ui } from "@/lib/copy";
import { REPORTS_VIEW, can } from "@/modules/access/domain/can";
import { sumExpenseCategory } from "@/modules/expense/application/sum-expense-category";
import { summarizeShopPeriod } from "@/modules/shop/application/summarize-shop-period";
import { periodChipLabel } from "../period-label";
import { readPeriodQuery, resolvePeriod } from "../period-url";
import { moneyHref } from "../query";

/**
 * Money > Shop: what the shop sold in the period (items, quantity, total) and what was spent on
 * shop supplies. Never a profit: supplies are bought in lots. reports.view. The sales include
 * items put on games that are not paid yet (see the caption).
 */
export default async function MoneyShopPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const membership = await requireOwnerMembership();
  const locale = await getUiLocale();

  if (!can(membership, REPORTS_VIEW)) {
    return <EmptyState title={ui("empty.noReports", locale)} next={ui("empty.noReportsNext", locale)} />;
  }

  const periodQuery = readPeriodQuery(params);
  const { kind, range } = resolvePeriod(periodQuery, new Date());
  const [shop, supplies] = await Promise.all([
    summarizeShopPeriod(range),
    sumExpenseCategory({ ...range, category: "SHOP_SUPPLIES" }),
  ]);
  const usd = (value: Decimal) => `$${formatUsdCompact(value)}`;

  return (
    <section className="flex flex-col gap-4">
      <OwnerBackLink
        href={moneyHref({ period: kind, ...(kind === "custom" ? range : {}), view: periodQuery.view })}
        locale={locale}
      />
      <h1 className="type-title">
        {ui("owner.shop", locale)} · {periodChipLabel(kind, range, locale)}
      </h1>

      <div className="flex flex-col gap-3 rounded-xl border bg-card p-4">
        <div className="flex items-baseline justify-between gap-3">
          <span className="type-secondary">{ui("owner.shopSales", locale)}</span>
          <LtrIsolate className="type-strong">{usd(shop.salesUsd)}</LtrIsolate>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <span className="type-secondary">{ui("owner.shopSupplies", locale)}</span>
          <LtrIsolate className="type-strong">{usd(supplies)}</LtrIsolate>
        </div>
        <p className="type-caption">{ui("owner.shopCaption", locale)}</p>
      </div>

      {shop.items.length > 0 ? (
        <div className="flex flex-col gap-1">
          <h2 className="type-section">{ui("owner.shopItems", locale)}</h2>
          <ul className="overflow-hidden rounded-xl border bg-card">
            {shop.items.map((item) => (
              <li key={item.productId} className="flex items-center justify-between gap-3 border-b px-4 py-3 last:border-b-0">
                <span className="type-body min-w-0 truncate">
                  <bdi>{item.name}</bdi>
                </span>
                <span className="type-secondary shrink-0">
                  <LtrIsolate>{`${item.qty} · ${usd(item.totalUsd)}`}</LtrIsolate>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="type-secondary">{ui("owner.shopNoSales", locale)}</p>
      )}
    </section>
  );
}
