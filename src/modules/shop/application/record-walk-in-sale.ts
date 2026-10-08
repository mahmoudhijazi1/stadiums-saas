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
import { freezeTenders, type TenderDraft } from "@/modules/payment/domain/collect";
import { findLatestExchangeRate } from "@/modules/payment/infrastructure/rates";
import { assertFullyPaid, lineTotal, mergeLines, saleTotal } from "@/modules/shop/domain/sale";
import { findActiveProducts } from "@/modules/shop/infrastructure/products";
import { insertSale, insertSaleItem } from "@/modules/shop/infrastructure/sales";
import { parseWalkInSale } from "@/modules/shop/schemas/sale";

export type WalkInSaleResult = { saleId: string; itemCount: number; totalUsd: Decimal };

/**
 * A counter sale paid on the spot. The prices come from the database at this moment, never from
 * the client; an archived item, an unknown id or another stadium's item is refused. Sale, its
 * lines, the SALE payment with its tenders and the ledger IN are written in ONE transaction, so
 * either all of it exists or none. The sale must be paid in full (no credit in this slice); more
 * than the total is accepted and recorded in full, exactly like collecting a whole booking
 * (the owner gives change by hand). No booking or pitch lock is needed: this path touches only
 * rows it creates (lock order: none, by design).
 */
export async function recordWalkInSale(input: unknown): Promise<WalkInSaleResult> {
  const membership = await getCurrentMembership();
  if (!membership || !can(membership, SHOP_SELL)) {
    throw new DomainError("access.not_allowed");
  }
  // Parsed outside the try: a malformed request is a ZodError for the action to map.
  const parsed = parseWalkInSale(input);
  const lines = mergeLines(parsed.lines);
  const drafts: TenderDraft[] = [];
  if (parsed.usdAmount) drafts.push({ currency: "USD", amount: parseUsd(parsed.usdAmount) });
  if (parsed.lbpAmount) drafts.push({ currency: "LBP", amount: parseLbp(parsed.lbpAmount) });

  try {
    const result = await db.$transaction(async (tx) => {
      const products = await findActiveProducts(tx, lines.map((line) => line.productId));
      const byId = new Map(products.map((product) => [product.id, product]));
      const priced = lines.map((line) => {
        const product = byId.get(line.productId);
        if (!product) throw new DomainError("shop.product_unavailable");
        return {
          productId: product.id,
          qty: line.qty,
          unitPriceUsd: product.priceUsd,
          lineTotalUsd: lineTotal(product.priceUsd, line.qty),
        };
      });
      const total = saleTotal(priced);

      const rate = await findLatestExchangeRate(tx);
      const frozen = freezeTenders(drafts, rate);
      const paid = frozen.reduce((sum, tender) => sum.plus(tender.usdEquivalent), new Decimal(0));
      assertFullyPaid(paid, total);

      const sale = await insertSale(tx, { createdByMembershipId: membership.membershipId });
      for (const line of priced) await insertSaleItem(tx, { saleId: sale.id, ...line });
      await recordPayment(tx, {
        direction: "IN",
        sourceType: "SALE",
        sourceId: sale.id,
        amountDueUsd: total,
        tenders: frozen,
      });
      return { saleId: sale.id, itemCount: priced.reduce((sum, line) => sum + line.qty, 0), totalUsd: total };
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
