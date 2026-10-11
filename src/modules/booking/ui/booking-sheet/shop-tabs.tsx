import type { UiLocale } from "@/lib/locale";
import { BookingItems, type ItemsActions } from "@/modules/booking/ui/booking-items";
import type { SellItem } from "@/modules/shop/ui/item-tiles";
import type { UpcomingRowView } from "@/modules/booking/ui/booking-sheet/row-view";

/** The shop tabs of the sheet: items on the game and the player tabs (reuses BookingItems). */
export function ShopTabs({
  row,
  shop,
  mayAdjust,
  mayCollect,
  lbpPerUsd,
  locale,
  itemsActions,
}: {
  row: UpcomingRowView;
  shop: { products: SellItem[]; maySell: boolean };
  mayAdjust: boolean;
  mayCollect: boolean;
  lbpPerUsd: string | null;
  locale: UiLocale;
  itemsActions: ItemsActions;
}) {
  return (
      <BookingItems {...itemsActions}
        bookingId={row.id}
        canAdd={shop.maySell && row.approved}
        mayRemove={mayAdjust}
        mayCollect={mayCollect}
        products={shop.products}
        view={row.items}
        lbpPerUsd={lbpPerUsd}
        locale={locale}
      />
  );
}
