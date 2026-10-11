import type { Ref } from "react";
import type { UiLocale } from "@/lib/locale";
import type { SellItem } from "@/modules/shop/ui/item-tiles";
import type { ItemsActions } from "@/modules/booking/ui/booking-items";
import { MoneyBlock, type CollectActions } from "@/modules/booking/ui/booking-sheet/money-block";
import { MoreActions } from "@/modules/booking/ui/booking-sheet/more-actions";
import type { UpcomingRowView } from "@/modules/booking/ui/booking-sheet/row-view";
import { SeriesRow } from "@/modules/booking/ui/booking-sheet/series-row";
import { ShopTabs } from "@/modules/booking/ui/booking-sheet/shop-tabs";

/** The details step of the sheet: series line, money block, shop tabs, More actions. */
export function UpcomingRowActions({
  row,
  lbpPerUsd,
  locale,
  mayCollect,
  mayCancel,
  mayNoShow,
  mayAdjust,
  shop,
  cancelRef,
  onCancelBooking,
  onNoShow,
  onAdjust,
  onExtend,
  onRepeat,
  onSeries,
  collectActions,
  itemsActions,
}: {
  row: UpcomingRowView;
  lbpPerUsd: string | null;
  locale: UiLocale;
  mayCollect: boolean;
  mayCancel: boolean;
  mayNoShow: boolean;
  mayAdjust: boolean;
  shop: { products: SellItem[]; maySell: boolean };
  cancelRef: Ref<HTMLButtonElement>;
  onCancelBooking: () => void;
  onNoShow: () => void;
  onAdjust: () => void;
  onExtend: () => void;
  onRepeat: () => void;
  onSeries: () => void;
  collectActions: CollectActions;
  itemsActions: ItemsActions;
}) {
  return (
    <>
      <SeriesRow row={row} onSeries={onSeries} />
      <MoneyBlock
        row={row}
        lbpPerUsd={lbpPerUsd}
        locale={locale}
        mayCollect={mayCollect}
        mayAdjust={mayAdjust}
        collectActions={collectActions}
      />

      <ShopTabs
        row={row}
        shop={shop}
        mayAdjust={mayAdjust}
        mayCollect={mayCollect}
        lbpPerUsd={lbpPerUsd}
        locale={locale}
        itemsActions={itemsActions}
      />

      <MoreActions
        row={row}
        locale={locale}
        mayCollect={mayCollect}
        mayCancel={mayCancel}
        mayNoShow={mayNoShow}
        mayAdjust={mayAdjust}
        cancelRef={cancelRef}
        onCancelBooking={onCancelBooking}
        onNoShow={onNoShow}
        onAdjust={onAdjust}
        onExtend={onExtend}
        onRepeat={onRepeat}
        collectActions={collectActions}
      />
    </>
  );
}
