import Decimal from "decimal.js";
import { DomainError } from "@/lib/errors";
import db from "@/lib/db";
import { logger } from "@/lib/logger";
import { safeTenantId } from "@/lib/tenant-context";
import { rethrowUnexpected } from "@/lib/use-case-error";
import { getCurrentMembership } from "@/modules/access/application/get-current-membership";
import { SHOP_SELL, can } from "@/modules/access/domain/can";
import { writeDueIfChanged } from "@/modules/booking/application/write-due-change";
import { findBookingForUpdate } from "@/modules/booking/infrastructure/bookings";
import { sumCollectedUsd } from "@/modules/payment/infrastructure/payments";
import { cleanPersonName } from "@/modules/people/domain/clean-person-name";
import { normalizePhone } from "@/modules/people/domain/phone";
import { findPersonById, findPersonByPhone } from "@/modules/people/infrastructure/persons";
import { lineTotal, mergeLines, saleTotal } from "@/modules/shop/domain/sale";
import {
  findGameSale,
  findNameTab,
  findPersonTab,
  insertBookingSale,
  lockSale,
  type BookingSaleRow,
} from "@/modules/shop/infrastructure/booking-sales";
import { findActiveProducts } from "@/modules/shop/infrastructure/products";
import { insertSaleItem } from "@/modules/shop/infrastructure/sales";
import { parseAddBookingItems } from "@/modules/shop/schemas/booking-items";

export type AddBookingItemsResult = {
  saleId: string;
  kind: "game" | "tab";
  itemCount: number;
  totalUsd: Decimal;
};

/**
 * Put items on a confirmed game. Needs `shop.sell` only.
 * `game`: a WHOLE booking due goes up by the lines (reason SHOP_ITEMS); the sale has no payer and
 * no payment of its own. `person` / `name`: that player's tab; it never touches the booking due or a
 * slot due, so it works in both collection modes. A second add for the same payer appends lines to the
 * same sale. Prices are read from the database; the client sends ids and quantities.
 * Lock order: the booking row first, then the sale row (an existing one; a new one is ours alone).
 */
export async function addBookingItems(input: unknown): Promise<AddBookingItemsResult> {
  const membership = await getCurrentMembership();
  if (!membership || !can(membership, SHOP_SELL)) throw new DomainError("access.not_allowed");
  // Parsed outside the try: a malformed request is a ZodError for the action to map.
  const parsed = parseAddBookingItems(input);
  const lines = mergeLines(parsed.lines);

  try {
    const result = await db.$transaction(async (tx) => {
      const booking = await findBookingForUpdate(tx, parsed.bookingId);
      if (!booking) throw new DomainError("booking.not_found");
      if (booking.status !== "APPROVED") throw new DomainError("shop.booking_not_open");
      const payer = parsed.payer;
      if (payer.kind === "game" && booking.collectionMode !== "WHOLE") {
        throw new DomainError("shop.game_items_whole_only");
      }

      const products = await findActiveProducts(tx, lines.map((line) => line.productId));
      const byId = new Map(products.map((product) => [product.id, product]));
      const priced = lines.map((line) => {
        const product = byId.get(line.productId);
        if (!product) throw new DomainError("shop.product_unavailable");
        return {
          productId: product.id,
          name: product.name,
          qty: line.qty,
          unitPriceUsd: product.priceUsd,
          lineTotalUsd: lineTotal(product.priceUsd, line.qty),
        };
      });
      const total = saleTotal(priced);

      let sale: BookingSaleRow | null;
      if (payer.kind === "game") {
        sale = await findGameSale(tx, booking.id);
        if (!sale) {
          sale = await insertBookingSale(tx, { createdByMembershipId: membership.membershipId, bookingId: booking.id });
        }
      } else if (payer.kind === "person") {
        if (!(await findPersonById(tx, payer.personId))) throw new DomainError("shop.player_not_found");
        sale = await findPersonTab(tx, booking.id, payer.personId);
        if (!sale) {
          sale = await insertBookingSale(tx, {
            createdByMembershipId: membership.membershipId,
            bookingId: booking.id,
            payerPersonId: payer.personId,
          });
        }
      } else {
        // A typed name. A phone that already belongs to a person makes it that person's tab.
        const phone = payer.phone ? normalizePhone(payer.phone) : "";
        const known = phone ? await findPersonByPhone(tx, phone) : null;
        const name = cleanPersonName(payer.name);
        sale = known ? await findPersonTab(tx, booking.id, known.id) : await findNameTab(tx, booking.id, name);
        if (!sale) {
          sale = await insertBookingSale(tx, {
            createdByMembershipId: membership.membershipId,
            bookingId: booking.id,
            ...(known ? { payerPersonId: known.id } : { payerName: name, ...(phone ? { payerPhone: phone } : {}) }),
          });
        }
      }
      // The sale row is held before lines are appended: a collection or a removal on it waits.
      if (!(await lockSale(tx, sale.id))) throw new DomainError("booking.not_found");

      for (const line of priced) {
        await insertSaleItem(tx, {
          saleId: sale.id,
          productId: line.productId,
          qty: line.qty,
          unitPriceUsd: line.unitPriceUsd,
          lineTotalUsd: line.lineTotalUsd,
        });
      }

      if (payer.kind === "game") {
        const collected = await sumCollectedUsd(tx, "BOOKING", booking.id);
        await writeDueIfChanged(tx, {
          bookingId: booking.id,
          fromUsd: booking.amountDueUsd,
          toUsd: booking.amountDueUsd.plus(total),
          collectedUsd: collected,
          collectionMode: booking.collectionMode,
          reason: "SHOP_ITEMS",
          note: priced.map((line) => `${line.name} x${line.qty}`).join(", ").slice(0, 200),
          actorMembershipId: membership.membershipId,
        });
      }

      return {
        saleId: sale.id,
        kind: payer.kind === "game" ? ("game" as const) : ("tab" as const),
        itemCount: priced.reduce((sum, line) => sum + line.qty, 0),
        totalUsd: total,
      };
    });

    logger.info(`Items added to booking ${parsed.bookingId} (${result.kind})`, undefined, {
      useCase: "addBookingItems",
      tenantId: await safeTenantId(),
    });
    return result;
  } catch (error) {
    return await rethrowUnexpected(error, "Add booking items failed", "addBookingItems");
  }
}
