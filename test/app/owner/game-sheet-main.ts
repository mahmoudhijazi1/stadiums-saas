import { createElement } from "react";
import type { UiLocale } from "@/lib/locale";
import type { ItemsActions } from "@/modules/booking/ui/booking-items";
import type { CollectActions } from "@/modules/booking/ui/booking-sheet/money-block";
import type { UpcomingRowView } from "@/modules/booking/ui/booking-sheet/row-view";
import { UpcomingRowActions } from "@/modules/booking/ui/booking-sheet/sheet-details";
import type { SellItem } from "@/modules/shop/ui/item-tiles";

/**
 * The game sheet's main view (facts, the money row, tiles, items, More actions and the bottom bar) as the
 * tests render it: the money area that used to be `MoneyBlock` is the money row plus the bottom bar.
 * Steps are callbacks the tests can watch.
 */
const noop = (async () => ({ ok: true as const })) as never;

export const ITEMS_ACTIONS: ItemsActions = {
  submitAddBookingItems: noop,
  submitWalkInSale: noop,
  submitCollectTab: noop,
  submitRemoveBookingItem: noop,
};

export type MainViewOptions = {
  locale?: UiLocale;
  mayCollect?: boolean;
  mayCancel?: boolean;
  mayNoShow?: boolean;
  mayAdjust?: boolean;
  shop?: { products: SellItem[]; maySell: boolean };
  steps?: Partial<Record<"onExtend" | "onSeries" | "onOther" | "onItems" | "onMore" | "onShares" | "onSplit" | "onItemsDone", () => void>>;
};

export function mainView(row: UpcomingRowView, collectActions: CollectActions, options: MainViewOptions = {}) {
  const step = (name: keyof NonNullable<MainViewOptions["steps"]>) => options.steps?.[name] ?? (() => {});
  return createElement(UpcomingRowActions, {
    row,
    lbpPerUsd: "89500",
    locale: options.locale ?? "en",
    mayCollect: options.mayCollect ?? true,
    mayCancel: options.mayCancel ?? true,
    mayNoShow: options.mayNoShow ?? true,
    mayAdjust: options.mayAdjust ?? true,
    shop: options.shop ?? { products: [], maySell: false },
    onExtend: step("onExtend"),
    onSeries: step("onSeries"),
    onOther: step("onOther"),
    onItems: step("onItems"),
    onMore: step("onMore"),
    onShares: step("onShares"),
    onSplit: step("onSplit"),
    onItemsDone: step("onItemsDone"),
    collectActions,
    itemsActions: ITEMS_ACTIONS,
  });
}
