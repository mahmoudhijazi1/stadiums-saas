import Decimal from "decimal.js";
import { DomainError } from "@/lib/errors";
import db from "@/lib/db";
import { logger } from "@/lib/logger";
import { parseLbp, parseUsd } from "@/lib/money";
import { safeTenantId } from "@/lib/tenant-context";
import { rethrowUnexpected } from "@/lib/use-case-error";
import { getCurrentMembership } from "@/modules/access/application/get-current-membership";
import { SHOP_SELL, can } from "@/modules/access/domain/can";
import { recordPayment } from "@/modules/payment/application/record-payment";
import { findLatestExchangeRate } from "@/modules/payment/infrastructure/rates";
import { mergeLines } from "@/modules/shop/domain/sale";
import {
  applyPayment,
  dueParts,
  itemPrice,
  owesAnything,
  paymentTenders,
  priceLine,
  settleState,
} from "@/modules/shop/domain/pricing";
import { insertSaleAllocation } from "@/modules/shop/infrastructure/sale-allocations";
import { findActiveProducts } from "@/modules/shop/infrastructure/products";
import { insertSale, insertSaleItem } from "@/modules/shop/infrastructure/sales";
import { parseWalkInSale } from "@/modules/shop/schemas/sale";

export type WalkInSaleResult = {
  saleId: string;
  itemCount: number;
  /** The frozen USD value of the sale (for reports). */
  totalUsd: Decimal;
  /** What the sale came to in each currency: pounds for LBP items, dollars for USD items. */
  totalLbp: Decimal;
  totalUsdPart: Decimal;
  /** What was handed over beyond the total, in the currency it was handed over in. */
  changeLbp: Decimal;
  changeUsd: Decimal;
};

/**
 * A counter sale paid on the spot. The prices come from the database at this moment, never from
 * the client; an archived item, an unknown id or another stadium's item is refused, and so is an
 * LBP-priced item while no exchange rate is set. Sale, its lines, the SALE payment with its tenders,
 * the ledger IN and the allocation are written in ONE transaction, so either all of it exists or
 * none. The sale is owed in the currencies of its items (pounds and/or dollars) and must be settled
 * in full (no credit in this slice). No booking or pitch lock is needed: this path touches only rows
 * it creates (lock order: none, by design).
 */
export async function recordWalkInSale(input: unknown): Promise<WalkInSaleResult> {
  const membership = await getCurrentMembership();
  if (!membership || !can(membership, SHOP_SELL)) {
    throw new DomainError("access.not_allowed");
  }
  // Parsed outside the try: a malformed request is a ZodError for the action to map.
  const parsed = parseWalkInSale(input);
  const lines = mergeLines(parsed.lines);
  const handed = {
    usd: parsed.usdAmount ? parseUsd(parsed.usdAmount) : new Decimal(0),
    lbp: parsed.lbpAmount ? parseLbp(parsed.lbpAmount) : new Decimal(0),
  };

  try {
    const result = await db.$transaction(async (tx) => {
      const rate = await findLatestExchangeRate(tx);
      const products = await findActiveProducts(tx, lines.map((line) => line.productId));
      const byId = new Map(products.map((product) => [product.id, product]));
      const priced = lines.map((line) => {
        const product = byId.get(line.productId);
        if (!product) throw new DomainError("shop.product_unavailable");
        return { productId: product.id, ...priceLine(itemPrice(product), line.qty, rate) };
      });
      const parts = dueParts(priced);

      const state = settleState({ parts, appliedLbp: new Decimal(0), appliedUsd: new Decimal(0), recordedUsd: new Decimal(0) });
      const application = applyPayment({ state, handed, rate });
      if (owesAnything({ remLbp: application.remLbpAfter, remUsd: application.remUsdAfter })) {
        throw new DomainError("shop.sale_not_fully_paid");
      }
      const tenders = paymentTenders({ application, handed, rate, keepChange: true });

      const sale = await insertSale(tx, { createdByMembershipId: membership.membershipId });
      for (const line of priced) await insertSaleItem(tx, { saleId: sale.id, ...line });
      const paymentId = await recordPayment(tx, {
        direction: "IN",
        sourceType: "SALE",
        sourceId: sale.id,
        amountDueUsd: parts.frozenUsd,
        tenders,
      });
      await insertSaleAllocation(tx, {
        saleId: sale.id,
        paymentId,
        lbpApplied: application.lbpApplied,
        usdApplied: application.usdApplied,
      });
      return {
        saleId: sale.id,
        itemCount: priced.reduce((sum, line) => sum + line.qty, 0),
        totalUsd: parts.frozenUsd,
        totalLbp: parts.dueLbp,
        totalUsdPart: parts.dueUsd,
        changeLbp: application.changeLbp,
        changeUsd: application.changeUsd,
      };
    });

    logger.info(`Walk-in sale ${result.saleId}`, undefined, {
      useCase: "recordWalkInSale",
      tenantId: await safeTenantId(),
    });
    return result;
  } catch (error) {
    return await rethrowUnexpected(error, "Record walk-in sale failed", "recordWalkInSale");
  }
}
