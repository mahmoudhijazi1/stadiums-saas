"use server";

import { actionErrorKey } from "@/lib/use-case-error";
import { recordWalkInSale } from "@/modules/shop/application/record-walk-in-sale";

/**
 * Thin: the use case authorizes (shop.sell), reads the prices and writes everything in one
 * transaction. No redirect (the screen shows a toast and goes back). Never sends a price.
 */
export type SellResult = { ok: true; itemCount: number; totalUsd: string } | { error: string };

export async function submitWalkInSale(input: unknown): Promise<SellResult> {
  try {
    const sale = await recordWalkInSale(input);
    return { ok: true, itemCount: sale.itemCount, totalUsd: sale.totalUsd.toFixed(2) };
  } catch (error) {
    return { error: await actionErrorKey(error, "submitWalkInSale") };
  }
}
