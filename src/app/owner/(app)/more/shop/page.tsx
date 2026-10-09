import { OwnerBackLink } from "@/app/owner/back-link";
import { requireOwnerMembership } from "@/app/owner/shared";
import { EmptyState } from "@/components/ui/empty-state";
import { getUiLocale } from "@/lib/get-ui-locale";
import { ui } from "@/lib/ui-copy";
import { SHOP_MANAGE, can } from "@/modules/access/domain/can";
import { listProducts } from "@/modules/shop/application/products";
import { ShopCatalog } from "./shop-catalog";

/** More > Business > Shop: the catalog. shop.manage (owner only), checked in the use case too. */
export default async function ShopCatalogPage() {
  const membership = await requireOwnerMembership();
  const locale = await getUiLocale();

  if (!can(membership, SHOP_MANAGE)) {
    return (
      <section className="flex flex-col gap-4">
        <OwnerBackLink href="/owner/more" locale={locale} history />
        <EmptyState title={ui("owner.shopNoAccess", locale)} next={ui("owner.shopNoAccessNext", locale)} />
      </section>
    );
  }

  const items = await listProducts({ forSale: false });
  return (
    <section className="flex flex-col gap-4">
      <OwnerBackLink href="/owner/more" locale={locale} history />
      <h2 className="type-title">{ui("owner.shop", locale)}</h2>
      <ShopCatalog
        locale={locale}
        items={items.map((item) => ({
          id: item.id,
          name: item.name,
          currency: item.priceCurrency,
          price: item.priceCurrency === "LBP" ? item.priceLbp!.toFixed(0) : item.priceUsd!.toFixed(2),
        }))}
      />
    </section>
  );
}
