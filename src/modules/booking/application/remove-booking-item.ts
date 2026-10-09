import { DomainError } from "@/lib/errors";
import db from "@/lib/db";
import { logger } from "@/lib/logger";
import { safeTenantId } from "@/lib/tenant-context";
import { rethrowUnexpected } from "@/lib/use-case-error";
import { getCurrentMembership } from "@/modules/access/application/get-current-membership";
import { BOOKINGS_ADJUST_DUE, can } from "@/modules/access/domain/can";
import { findBookingForUpdate } from "@/modules/booking/infrastructure/bookings";
import { sumCollectedUsd } from "@/modules/payment/infrastructure/payments";
import { assertRemovalQty, isTab, netLines } from "@/modules/shop/domain/booking-items";
import { lbpReversal } from "@/modules/shop/domain/pricing";
import {
  findSale,
  findSaleItem,
  insertReversalItem,
  listStoredLines,
  lockSale,
} from "@/modules/shop/infrastructure/booking-sales";
import { parseRemoveBookingItem } from "@/modules/shop/schemas/booking-items";

/**
 * Take some of an item back off a player's tab, while the tab has no payment at all. Needs
 * `bookings.adjust_due`. Nothing is deleted: a compensating line with a negative quantity is added.
 * Lock order: the booking row first, then the sale row.
 */
export async function removeBookingItem(input: unknown): Promise<void> {
  const membership = await getCurrentMembership();
  if (!membership || !can(membership, BOOKINGS_ADJUST_DUE)) throw new DomainError("access.not_allowed");
  const parsed = parseRemoveBookingItem(input);

  try {
    await db.$transaction(async (tx) => {
      // Lines are immutable, so learning which sale and booking this is before locking is safe.
      const item = await findSaleItem(tx, parsed.itemId);
      if (!item || item.reversesItemId) throw new DomainError("shop.item_not_found");
      const sale = await findSale(tx, item.saleId);
      if (!sale?.bookingId || !isTab(sale)) throw new DomainError("shop.item_not_found");

      const booking = await findBookingForUpdate(tx, sale.bookingId);
      if (!booking) throw new DomainError("booking.not_found");
      if (!(await lockSale(tx, sale.id))) throw new DomainError("shop.item_not_found");

      const net = netLines(await listStoredLines(tx, sale.id)).find((line) => line.id === item.id);
      if (!net) throw new DomainError("shop.remove_exceeds");
      assertRemovalQty(net.qty, parsed.qty);
      if ((await sumCollectedUsd(tx, "SALE", sale.id)).gt(0)) throw new DomainError("shop.tab_has_payments");

      // A USD line gives back qty x its price. An LBP line gives back the pounds, and its USD value is
      // set so that the lines of the item still add up to the conversion of the pounds that remain.
      const reversal =
        net.unitPriceLbp && net.rateAtTime
          ? lbpReversal({
              unitPriceLbp: net.unitPriceLbp,
              rateAtTime: net.rateAtTime,
              netQtyBefore: net.qty,
              netUsdBefore: net.totalUsd,
              removedQty: parsed.qty,
            })
          : { lineTotalLbp: null, lineTotalUsd: item.unitPriceUsd.times(parsed.qty).negated() };
      await insertReversalItem(tx, {
        saleId: sale.id,
        original: {
          id: item.id,
          productId: item.productId,
          unitPriceUsd: item.unitPriceUsd,
          unitPriceLbp: item.unitPriceLbp,
          rateAtTime: item.rateAtTime,
        },
        qty: parsed.qty,
        lineTotalUsd: reversal.lineTotalUsd,
        lineTotalLbp: reversal.lineTotalLbp,
      });
    });

    logger.info(`Item removed ${parsed.itemId}`, undefined, {
      useCase: "removeBookingItem",
      tenantId: await safeTenantId(),
    });
  } catch (error) {
    await rethrowUnexpected(error, "Remove booking item failed", "removeBookingItem");
  }
}
