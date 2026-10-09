import Decimal from "decimal.js";
import { DomainError } from "@/lib/errors";
import db from "@/lib/db";
import { logger } from "@/lib/logger";
import { safeTenantId } from "@/lib/tenant-context";
import { rethrowUnexpected } from "@/lib/use-case-error";
import { getCurrentMembership } from "@/modules/access/application/get-current-membership";
import { SHOP_SELL, can } from "@/modules/access/domain/can";
import { findBookingForUpdate, findRequesterPersonId } from "@/modules/booking/infrastructure/bookings";
import { cleanPersonName } from "@/modules/people/domain/clean-person-name";
import { normalizePhone } from "@/modules/people/domain/phone";
import { findPersonById, findPersonByPhone } from "@/modules/people/infrastructure/persons";
import { findLatestExchangeRate } from "@/modules/payment/infrastructure/rates";
import { mergeLines } from "@/modules/shop/domain/sale";
import { dueParts, itemPrice, priceLine } from "@/modules/shop/domain/pricing";
import {
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
  itemCount: number;
  totalUsd: Decimal;
};

/**
 * Put items on a confirmed game, on a player's tab. Needs `shop.sell` only.
 * The payer is "game" (the booker: the booking's requester), a person, or a typed name with an
 * optional phone. Either way it is that payer's own tab: it never touches the booking due or a slot
 * due, so it works in both collection modes. A second add for the same payer appends lines to the
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

      // Prices come from the database now. An LBP item freezes its USD value at the current rate and
      // cannot be sold while no rate is set.
      const rate = await findLatestExchangeRate(tx);
      const products = await findActiveProducts(tx, lines.map((line) => line.productId));
      const byId = new Map(products.map((product) => [product.id, product]));
      const priced = lines.map((line) => {
        const product = byId.get(line.productId);
        if (!product) throw new DomainError("shop.product_unavailable");
        return { productId: product.id, ...priceLine(itemPrice(product), line.qty, rate) };
      });
      const total = dueParts(priced).frozenUsd;

      // Who pays: the booker, a person, or a typed name. All three are a tab.
      const payer = parsed.payer;
      let personId: string | null = null;
      let typed: { name: string; phone: string } | null = null;
      if (payer.kind === "game") {
        personId = await findRequesterPersonId(tx, booking.id);
        if (!personId) throw new DomainError("booking.not_found");
      } else if (payer.kind === "person") {
        if (!(await findPersonById(tx, payer.personId))) throw new DomainError("shop.player_not_found");
        personId = payer.personId;
      } else {
        // A phone that already belongs to a person makes it that person's tab.
        const phone = payer.phone ? normalizePhone(payer.phone) : "";
        const known = phone ? await findPersonByPhone(tx, phone) : null;
        if (known) personId = known.id;
        else typed = { name: cleanPersonName(payer.name), phone };
      }

      let sale: BookingSaleRow | null = personId
        ? await findPersonTab(tx, booking.id, personId)
        : await findNameTab(tx, booking.id, typed!.name);
      if (!sale) {
        sale = await insertBookingSale(tx, {
          createdByMembershipId: membership.membershipId,
          bookingId: booking.id,
          ...(personId
            ? { payerPersonId: personId }
            : { payerName: typed!.name, ...(typed!.phone ? { payerPhone: typed!.phone } : {}) }),
        });
      }
      // The sale row is held before lines are appended: a collection or a removal on it waits.
      if (!(await lockSale(tx, sale.id))) throw new DomainError("booking.not_found");

      for (const line of priced) {
        await insertSaleItem(tx, { saleId: sale.id, ...line });
      }

      return { saleId: sale.id, itemCount: priced.reduce((sum, line) => sum + line.qty, 0), totalUsd: total };
    });

    logger.info(`Items added to booking ${parsed.bookingId}`, undefined, {
      useCase: "addBookingItems",
      tenantId: await safeTenantId(),
    });
    return result;
  } catch (error) {
    return await rethrowUnexpected(error, "Add booking items failed", "addBookingItems");
  }
}
