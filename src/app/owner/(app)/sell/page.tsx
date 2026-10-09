import Link from "next/link";
import { OwnerBackLink } from "@/app/owner/back-link";
import { requireOwnerMembership } from "@/app/owner/shared";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { getUiLocale } from "@/lib/get-ui-locale";
import { ui } from "@/lib/ui-copy";
import { SHOP_MANAGE, SHOP_SELL, can } from "@/modules/access/domain/can";
import { getCurrentRate } from "@/modules/payment/application/get-current-rate";
import { listProducts } from "@/modules/shop/application/products";
import { SellScreen } from "./sell-screen";

/** The counter: tap items, then Collect. shop.sell (checked in the use cases too). */
export default async function SellPage() {
  const membership = await requireOwnerMembership();
  const locale = await getUiLocale();

  if (!can(membership, SHOP_SELL)) {
    return (
      <section className="flex flex-col gap-4">
        <OwnerBackLink href="/owner/today" locale={locale} history />
        <EmptyState title={ui("owner.sellNoAccess", locale)} next={ui("owner.sellNoAccessNext", locale)} />
      </section>
    );
  }

  const [items, rate] = await Promise.all([listProducts({ forSale: true }), getCurrentRate()]);

  return (
    <section className="flex flex-col gap-4">
      <OwnerBackLink href="/owner/today" locale={locale} history />
      <h2 className="type-title">{ui("owner.sell", locale)}</h2>
      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <p className="type-body">{ui("owner.sellNoItems", locale)}</p>
          {can(membership, SHOP_MANAGE) ? (
            <Button asChild>
              <Link href="/owner/more/shop">{ui("owner.sellFirstItem", locale)}</Link>
            </Button>
          ) : (
            <p className="type-secondary">{ui("owner.sellFirstItemStaff", locale)}</p>
          )}
        </div>
      ) : (
        <SellScreen
          locale={locale}
          lbpPerUsd={rate ? rate.toString() : null}
          items={items.map((item) => ({
            id: item.id,
            name: item.name,
            currency: item.priceCurrency,
            price: item.priceCurrency === "LBP" ? item.priceLbp!.toFixed(0) : item.priceUsd!.toFixed(2),
          }))}
        />
      )}
    </section>
  );
}
