"use server";

import { actionErrorKey } from "@/lib/use-case-error";
import { addBookingItems } from "@/modules/booking/application/add-booking-items";
import { removeBookingItem } from "@/modules/booking/application/remove-booking-item";
import { collectTabPayment } from "@/modules/shop/application/collect-tab-payment";
import { recordWalkInSale } from "@/modules/shop/application/record-walk-in-sale";
import type { WalkInSaleResult } from "@/modules/shop/ui/sell-screen";
import type { ItemsResult } from "@/modules/booking/ui/action-types";
export type { ItemsResult };


export async function submitAddBookingItems(input: unknown): Promise<ItemsResult> {
  try {
    const added = await addBookingItems(input);
    return { ok: true, itemCount: added.itemCount };
  } catch (error) {
    return { error: await actionErrorKey(error, "submitAddBookingItems") };
  }
}

/** "Pay now" from a game: the same walk-in sale as the counter, with no payer. */
export async function submitWalkInSale(input: unknown): Promise<WalkInSaleResult> {
  try {
    const sale = await recordWalkInSale(input);
    return {
      ok: true,
      itemCount: sale.itemCount,
      totalLbp: sale.totalLbp.toFixed(0),
      totalUsdPart: sale.totalUsdPart.toFixed(2),
      changeLbp: sale.changeLbp.toFixed(0),
      changeUsd: sale.changeUsd.toFixed(2),
    };
  } catch (error) {
    return { error: await actionErrorKey(error, "submitWalkInSale") };
  }
}

export async function submitRemoveBookingItem(input: unknown): Promise<ItemsResult> {
  try {
    await removeBookingItem(input);
    return { ok: true };
  } catch (error) {
    return { error: await actionErrorKey(error, "submitRemoveBookingItem") };
  }
}

export async function submitCollectTab(input: unknown): Promise<ItemsResult> {
  try {
    const change = await collectTabPayment(input);
    return { ok: true, changeLbp: change.changeLbp.toFixed(0), changeUsd: change.changeUsd.toFixed(2) };
  } catch (error) {
    return { error: await actionErrorKey(error, "submitCollectTab") };
  }
}
