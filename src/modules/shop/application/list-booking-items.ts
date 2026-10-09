import Decimal from "decimal.js";
import { DomainError } from "@/lib/errors";
import db from "@/lib/db";
import { rethrowUnexpected } from "@/lib/use-case-error";
import { getCurrentMembership } from "@/modules/access/application/get-current-membership";
import { listTendersBySourceIds } from "@/modules/payment/infrastructure/payments";
import { isTab, netLines, type NetLine } from "@/modules/shop/domain/booking-items";
import { dueParts, settleState } from "@/modules/shop/domain/pricing";
import { listSalesOnBookings } from "@/modules/shop/infrastructure/booking-sales";
import { sumAllocations } from "@/modules/shop/infrastructure/sale-allocations";

export type TabView = {
  saleId: string;
  personId: string | null;
  name: string;
  phone: string | null;
  lines: NetLine[];
  /** What the tab came to, frozen in USD (for reports) and in each currency of its items. */
  totalUsd: Decimal;
  dueLbp: Decimal;
  dueUsd: Decimal;
  /** The USD the payments recorded. */
  paidUsd: Decimal;
  /** What is still owed, in the currency of the items: pounds for LBP items, dollars for USD items. */
  remainingLbp: Decimal;
  remainingUsd: Decimal;
  /** Everything still owed at frozen USD values: what the aggregate totals count. */
  outstandingFrozenUsd: Decimal;
};

export type BookingItemsView = {
  bookingId: string;
  /** Every sale on a game is a player's tab, the booker's included ("On the game (booker)"). */
  tabs: TabView[];
};

/**
 * What was put on these games, for the booking sheet: each player tab with what it has paid and what
 * it still owes in each currency. A few reads for any number of games. Any signed-in member who can
 * see Today.
 */
export async function listBookingItems(bookingIds: string[]): Promise<Map<string, BookingItemsView>> {
  const membership = await getCurrentMembership();
  if (!membership) throw new DomainError("access.not_allowed");
  const unique = [...new Set(bookingIds)];
  if (unique.length === 0) return new Map();

  try {
    const sales = (await listSalesOnBookings(db, unique)).filter(isTab);
    const tabIds = sales.map((sale) => sale.id);
    const [tenders, applied] = await Promise.all([listTendersBySourceIds(db, "SALE", tabIds), sumAllocations(db, tabIds)]);
    const paidBySale = new Map<string, Decimal>();
    for (const tender of tenders) {
      paidBySale.set(tender.sourceId, (paidBySale.get(tender.sourceId) ?? new Decimal(0)).plus(tender.usdEquivalent));
    }

    const result = new Map<string, BookingItemsView>();
    for (const sale of sales) {
      if (!sale.bookingId) continue;
      const view = result.get(sale.bookingId) ?? ({ bookingId: sale.bookingId, tabs: [] } satisfies BookingItemsView);
      const lines = netLines(sale.lines);
      if (lines.length > 0) {
        const parts = dueParts(lines.map((line) => ({ lineTotalUsd: line.totalUsd, lineTotalLbp: line.totalLbp })));
        const paid = paidBySale.get(sale.id) ?? new Decimal(0);
        const sums = applied.get(sale.id) ?? { lbp: new Decimal(0), usd: new Decimal(0) };
        const state = settleState({ parts, appliedLbp: sums.lbp, appliedUsd: sums.usd, recordedUsd: paid });
        view.tabs.push({
          saleId: sale.id,
          personId: sale.payerPersonId,
          name: sale.displayName ?? "",
          phone: sale.displayPhone,
          lines,
          totalUsd: parts.frozenUsd,
          dueLbp: parts.dueLbp,
          dueUsd: parts.dueUsd,
          paidUsd: paid,
          remainingLbp: state.remLbp,
          remainingUsd: state.remUsd,
          outstandingFrozenUsd: state.outstandingFrozenUsd,
        });
      }
      result.set(sale.bookingId, view);
    }
    return result;
  } catch (error) {
    return await rethrowUnexpected(error, "List booking items failed", "listBookingItems");
  }
}
