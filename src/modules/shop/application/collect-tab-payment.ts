import { DomainError } from "@/lib/errors";
import db from "@/lib/db";
import { logger } from "@/lib/logger";
import { parseLbp, parseUsd } from "@/lib/money";
import { safeTenantId } from "@/lib/tenant-context";
import { rethrowUnexpected } from "@/lib/use-case-error";
import { getCurrentMembership } from "@/modules/access/application/get-current-membership";
import { PAYMENTS_COLLECT, can } from "@/modules/access/domain/can";
import { recordPayment } from "@/modules/payment/application/record-payment";
import { assertHasDue, freezeTenders, type TenderDraft } from "@/modules/payment/domain/collect";
import { sumCollectedUsd } from "@/modules/payment/infrastructure/payments";
import { findLatestExchangeRate } from "@/modules/payment/infrastructure/rates";
import { isTab, netLines, netTotal, tabRemaining } from "@/modules/shop/domain/booking-items";
import { findSale, listStoredLines, lockSale } from "@/modules/shop/infrastructure/booking-sales";
import { parseCollectTab } from "@/modules/shop/schemas/booking-items";

/**
 * Collect cash on a player tab, with the same rules as collecting a whole booking: any positive
 * amount is accepted (a part is fine), nothing is capped, more than the tab is recorded in full.
 * Needs `payments.collect`. Only the sale row is locked: a tab never touches the booking due, so
 * collecting waits for an add or a removal on that tab and for nothing else.
 * Writes the SALE payment, its tenders and the ledger IN in this transaction.
 */
export async function collectTabPayment(input: unknown): Promise<void> {
  const membership = await getCurrentMembership();
  if (!membership || !can(membership, PAYMENTS_COLLECT)) throw new DomainError("access.not_allowed");
  const parsed = parseCollectTab(input);
  const drafts: TenderDraft[] = [];
  if (parsed.usdAmount) drafts.push({ currency: "USD", amount: parseUsd(parsed.usdAmount) });
  if (parsed.lbpAmount) drafts.push({ currency: "LBP", amount: parseLbp(parsed.lbpAmount) });

  try {
    const paymentId = await db.$transaction(async (tx) => {
      if (!(await lockSale(tx, parsed.saleId))) throw new DomainError("shop.not_a_tab");
      const sale = await findSale(tx, parsed.saleId);
      if (!sale || !isTab(sale)) throw new DomainError("shop.not_a_tab");

      const total = netTotal(netLines(await listStoredLines(tx, sale.id)));
      const collected = await sumCollectedUsd(tx, "SALE", sale.id);
      assertHasDue(tabRemaining(total, collected));

      const frozen = freezeTenders(drafts, await findLatestExchangeRate(tx));
      return recordPayment(tx, {
        direction: "IN",
        sourceType: "SALE",
        sourceId: sale.id,
        amountDueUsd: total,
        tenders: frozen,
      });
    });

    logger.info(`Tab payment collected ${paymentId} sale ${parsed.saleId}`, undefined, {
      useCase: "collectTabPayment",
      tenantId: await safeTenantId(),
    });
  } catch (error) {
    await rethrowUnexpected(error, "Collect tab payment failed", "collectTabPayment");
  }
}
