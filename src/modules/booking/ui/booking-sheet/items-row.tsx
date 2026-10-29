"use client";

import { useState } from "react";
import Decimal from "decimal.js";
import { ChevronRight, ShoppingBag } from "lucide-react";
import type { UiLocale } from "@/lib/locale";
import { ui, uiCount } from "@/lib/copy";
import { formatParts } from "@/lib/format/money";
import { LtrIsolate } from "@/components/ui/ltr-isolate";
import type { SellItem } from "@/modules/shop/ui/item-tiles";
import { AddItemsSheet } from "@/modules/booking/ui/add-items-sheet";
import type { BookingItemsPanelView, ItemsActions } from "@/modules/booking/ui/booking-items";

/** What the tabs of a game come to, per currency: the item lines summed in their own currency. */
export function tabsTotal(view: BookingItemsPanelView): { lbp: Decimal; usd: Decimal } {
  let lbp = new Decimal(0);
  let usd = new Decimal(0);
  for (const tab of view.tabs) {
    for (const line of tab.lines) {
      if (line.currency === "LBP") lbp = lbp.plus(line.total);
      else usd = usd.plus(line.total);
    }
  }
  return { lbp, usd };
}

/**
 * Items as ONE summary row: "Items · None" with "+ Add" (only inside the 60-minute window, as
 * today: `mayAdd`), or the number of tabs, the first names and the total per currency, opening the
 * Items view with the tab list. No row at all when there is nothing to show and nothing to add.
 */
export function ItemsRow({
  bookingId,
  view,
  mayAdd,
  products,
  lbpPerUsd,
  locale,
  onOpen,
  onDone,
  itemsActions,
}: {
  bookingId: string;
  view: BookingItemsPanelView;
  /** The game is open for items (confirmed, from 60 minutes before the start) and the member may sell. */
  mayAdd: boolean;
  products: SellItem[];
  lbpPerUsd: string | null;
  locale: UiLocale;
  onOpen: () => void;
  /** After items are added: the page refreshes its data. */
  onDone: () => void;
  itemsActions: ItemsActions;
}) {
  const [addOpen, setAddOpen] = useState(false);
  const canAdd = mayAdd && products.length > 0;
  const count = view.tabs.length;
  if (count === 0 && !canAdd) return null;

  const names = new Intl.ListFormat(locale === "en" ? "en" : "ar", { type: "conjunction", style: "short" }).format(
    view.tabs.slice(0, 2).map((tab) => tab.name.split(" ")[0] ?? tab.name),
  );
  const addButton = canAdd ? (
    <button
      type="button"
      onClick={() => setAddOpen(true)}
      className="inline-flex min-h-11 shrink-0 items-center rounded-full px-3 type-label text-action-ink outline-none hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      {ui("owner.itemsAdd", locale)}
    </button>
  ) : null;

  return (
    <>
      <div className="flex min-h-14 items-center gap-2 rounded-xl border bg-card ps-4 pe-1">
        <ShoppingBag aria-hidden className="size-5 shrink-0 text-muted-foreground" />
        {count === 0 ? (
          <span className="flex min-w-0 flex-1 items-baseline gap-2 py-2">
            <span className="type-label">{ui("owner.itemsHeading", locale)}</span>
            <span className="type-secondary">{ui("owner.itemsNone", locale)}</span>
          </span>
        ) : (
          <button
            type="button"
            onClick={onOpen}
            className="flex min-h-14 min-w-0 flex-1 items-center gap-2 py-2 text-start outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="type-label">
                {ui("owner.itemsHeading", locale)} · {uiCount("owner.tabCount", count, locale)}
              </span>
              <span className="type-secondary truncate">
                <bdi>{names}</bdi>
              </span>
            </span>
            <LtrIsolate className="type-strong shrink-0">{formatParts(tabsTotal(view), locale)}</LtrIsolate>
            <ChevronRight aria-hidden className="size-5 shrink-0 text-muted-foreground rtl:rotate-180" />
          </button>
        )}
        {count === 0 ? addButton : null}
      </div>
      {canAdd ? (
        <AddItemsSheet
          submitAddBookingItems={itemsActions.submitAddBookingItems}
          submitWalkInSale={itemsActions.submitWalkInSale}
          open={addOpen}
          onClose={() => setAddOpen(false)}
          bookingId={bookingId}
          bookerName={view.bookerName}
          bookerPersonId={view.bookerPersonId}
          tabPayers={view.tabs.map((tab) => ({ personId: tab.personId, name: tab.name }))}
          products={products}
          lbpPerUsd={lbpPerUsd}
          locale={locale}
          onDone={onDone}
        />
      ) : null}
    </>
  );
}
