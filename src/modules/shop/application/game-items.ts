import { DomainError } from "@/lib/errors";
import type { TenantTx } from "@/lib/db";
import { sumGameItems } from "@/modules/shop/infrastructure/booking-sales";

/**
 * Refuse while the game has "on the game" items: they raised its due, so cancelling, marking a
 * no-show or splitting it per player would carry the shop money into fees and slot dues. The
 * owner removes them first. Call after the booking row is locked (the adds hold that lock too), so
 * this read cannot race an add. Player tabs do not count: they are never part of the booking due.
 */
export async function assertNoGameItems(tx: TenantTx, bookingId: string): Promise<void> {
  if ((await sumGameItems(tx, bookingId)).gt(0)) {
    throw new DomainError("shop.booking_has_items");
  }
}
