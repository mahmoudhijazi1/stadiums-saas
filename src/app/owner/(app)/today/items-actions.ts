"use server";

import { actionErrorKey } from "@/lib/use-case-error";
import { addBookingItems } from "@/modules/booking/application/add-booking-items";
import { removeBookingItem } from "@/modules/booking/application/remove-booking-item";
import { searchPeople } from "@/modules/people/application/search-people";
import { collectTabPayment } from "@/modules/shop/application/collect-tab-payment";

/**
 * Thin: each use case authorizes (shop.sell, bookings.adjust_due, payments.collect), reads the
 * prices itself and writes in one transaction. The client sends ids and quantities, never a price.
 * The booking sheet refreshes the page after a success.
 */
export type ItemsResult = { ok: true; itemCount?: number } | { error: string };

export async function submitAddBookingItems(input: unknown): Promise<ItemsResult> {
  try {
    const added = await addBookingItems(input);
    return { ok: true, itemCount: added.itemCount };
  } catch (error) {
    return { error: await actionErrorKey(error, "submitAddBookingItems") };
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
    await collectTabPayment(input);
    return { ok: true };
  } catch (error) {
    return { error: await actionErrorKey(error, "submitCollectTab") };
  }
}

export type PayerHit = { id: string; name: string; phone: string | null };

/** Person search for the payer picker: the same search as the header, five hits. */
export async function searchPayers(query: string): Promise<{ hits: PayerHit[] } | { error: string }> {
  try {
    const hits = await searchPeople(query.slice(0, 80));
    return { hits: hits.slice(0, 5).map((hit) => ({ id: hit.id, name: hit.name, phone: hit.phone })) };
  } catch (error) {
    return { error: await actionErrorKey(error, "searchPayers") };
  }
}
