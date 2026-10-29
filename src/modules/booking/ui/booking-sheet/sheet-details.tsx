"use client";

import { useState } from "react";
import type { UiLocale } from "@/lib/locale";
import type { SellItem } from "@/modules/shop/ui/item-tiles";
import type { ItemsActions } from "@/modules/booking/ui/booking-items";
import type { AdvanceStep } from "@/modules/booking/ui/booking-sheet/collect-advance";
import { FactsCard } from "@/modules/booking/ui/booking-sheet/facts-card";
import { ItemsRow } from "@/modules/booking/ui/booking-sheet/items-row";
import { CollectBar, MoneyRow, collectStateOf, type CollectActions } from "@/modules/booking/ui/booking-sheet/money-block";
import { MoreActionsRow, moreActionsOf } from "@/modules/booking/ui/booking-sheet/more-actions";
import { QuickTiles, quickTilesOf } from "@/modules/booking/ui/booking-sheet/quick-tiles";
import type { UpcomingRowView } from "@/modules/booking/ui/booking-sheet/row-view";

/**
 * The main view of the game sheet (ui-rules: state first, facts in rows, money as one row, one action at
 * the bottom, sub-screens instead of inline expansion): the facts card, the money row, the quick tiles
 * (a game not ended yet), the items row, the More actions row, and the bottom bar with the one primary
 * Collect only when there is something to collect now. Every other screen is a step (`on*`).
 */
export function UpcomingRowActions({
  row,
  lbpPerUsd,
  locale,
  mayCollect,
  mayCancel,
  mayNoShow,
  mayAdjust,
  shop,
  onExtend,
  onSeries,
  onOther,
  onItems,
  onMore,
  onShares,
  onSplit,
  onItemsDone,
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
  onExtend: () => void;
  onSeries: () => void;
  onOther: () => void;
  onItems: () => void;
  onMore: () => void;
  onShares: () => void;
  onSplit: () => void;
  /** After items are added (the page refreshes). */
  onItemsDone: () => void;
  collectActions: CollectActions;
  itemsActions: ItemsActions;
}) {
  const [advance, setAdvance] = useState<AdvanceStep>("idle");
  const state = collectStateOf({
    row,
    mayCollect,
    advance,
    lbpPerUsd,
    mayForgive: collectActions.submitConsiderPaid !== undefined,
  });
  const actions = moreActionsOf(row, { mayCancel, mayNoShow, mayAdjust });

  return (
    <>
      <FactsCard row={row} locale={locale} onSeries={onSeries} />
      <MoneyRow
        row={row}
        state={state}
        advance={advance}
        onAdvance={setAdvance}
        onShares={onShares}
        locale={locale}
        submitConsiderPaid={collectActions.submitConsiderPaid}
      />
      <QuickTiles tiles={quickTilesOf(row, actions)} locale={locale} onExtend={onExtend} onSplit={onSplit} />
      <ItemsRow
        bookingId={row.id}
        view={row.items}
        mayAdd={shop.maySell && row.mayAddItems}
        products={shop.products}
        lbpPerUsd={lbpPerUsd}
        locale={locale}
        onOpen={onItems}
        onDone={onItemsDone}
        itemsActions={itemsActions}
      />
      <MoreActionsRow count={actions.length} locale={locale} onOpen={onMore} />
      {state.collectNow ? (
        <CollectBar row={row} locale={locale} onOtherAmount={onOther} submitCollectPayment={collectActions.submitCollectPayment} />
      ) : null}
    </>
  );
}
