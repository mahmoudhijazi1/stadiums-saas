import Decimal from "decimal.js";
import { DomainError } from "@/lib/errors";
import db from "@/lib/db";
import { logger } from "@/lib/logger";
import { parseLbp, parseUsd } from "@/lib/money";
import { safeTenantId } from "@/lib/tenant-context";
import { rethrowUnexpected } from "@/lib/use-case-error";
import { getCurrentMembership } from "@/modules/access/application/get-current-membership";
import { PAYMENTS_COLLECT, can } from "@/modules/access/domain/can";
import { recordPayment } from "@/modules/payment/application/record-payment";
import { findLatestExchangeRate } from "@/modules/payment/infrastructure/rates";
import { loadSaleState } from "@/modules/shop/application/sale-state";
import { isTab } from "@/modules/shop/domain/booking-items";
import { applyPayment, owesAnything, paymentTenders } from "@/modules/shop/domain/pricing";
import { findSale, lockSale } from "@/modules/shop/infrastructure/booking-sales";
import { insertSaleAllocation } from "@/modules/shop/infrastructure/sale-allocations";
import { parseCollectTab } from "@/modules/shop/schemas/booking-items";

/**
 * Collect cash on a player tab. Any positive part is accepted. The tab is owed in the currencies of
 * its items: pounds for LBP items, dollars for USD items. Pounds settle the LBP part first, dollars
 * the USD part first, and any excess converts to the other part at the current rate. A rate change
 * after an item was added never changes the pounds owed.
 * Cash beyond what is owed is not recorded: the tender is reduced to what the tab used and the rest
 * comes back as change, in the currency it was handed over in (a booking collection is unchanged: it
 * records an overpay in full).
 * Needs `payments.collect`. Only the sale row is locked: a tab never touches the booking due, so
 * collecting waits for an add or a removal on that tab and for nothing else.
 * Writes the SALE payment, its tenders, the ledger IN and the allocation in this transaction.
 */
export async function collectTabPayment(input: unknown): Promise<{ changeLbp: Decimal; changeUsd: Decimal }> {
  const membership = await getCurrentMembership();
  if (!membership || !can(membership, PAYMENTS_COLLECT)) throw new DomainError("access.not_allowed");
  const parsed = parseCollectTab(input);
  const handed = {
    lbp: parsed.lbpAmount ? parseLbp(parsed.lbpAmount) : new Decimal(0),
    usd: parsed.usdAmount ? parseUsd(parsed.usdAmount) : new Decimal(0),
  };
  if (handed.lbp.isZero() && handed.usd.isZero()) throw new DomainError("payment.amount_required");

  try {
    const outcome = await db.$transaction(async (tx) => {
      if (!(await lockSale(tx, parsed.saleId))) throw new DomainError("shop.not_a_tab");
      const sale = await findSale(tx, parsed.saleId);
      if (!sale || !isTab(sale)) throw new DomainError("shop.not_a_tab");

      const { parts, state } = await loadSaleState(tx, sale.id);
      if (!owesAnything(state)) throw new DomainError("payment.nothing_due");

      const rate = await findLatestExchangeRate(tx);
      if (handed.lbp.gt(0) && (!rate || rate.lte(0))) throw new DomainError("payment.rate_required");
      const application = applyPayment({ state, handed, rate });
      const paymentId = await recordPayment(tx, {
        direction: "IN",
        sourceType: "SALE",
        sourceId: sale.id,
        amountDueUsd: parts.frozenUsd,
        tenders: paymentTenders({ application, handed, rate, keepChange: false }),
      });
      await insertSaleAllocation(tx, {
        saleId: sale.id,
        paymentId,
        lbpApplied: application.lbpApplied,
        usdApplied: application.usdApplied,
      });
      return { paymentId, changeLbp: application.changeLbp, changeUsd: application.changeUsd };
    });

    logger.info(`Tab payment collected ${outcome.paymentId} sale ${parsed.saleId}`, undefined, {
      useCase: "collectTabPayment",
      tenantId: await safeTenantId(),
    });
    return { changeLbp: outcome.changeLbp, changeUsd: outcome.changeUsd };
  } catch (error) {
    return await rethrowUnexpected(error, "Collect tab payment failed", "collectTabPayment");
  }
}
