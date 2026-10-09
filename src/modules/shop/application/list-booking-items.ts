import Decimal from "decimal.js";
import { DomainError } from "@/lib/errors";
import db from "@/lib/db";
import { rethrowUnexpected } from "@/lib/use-case-error";
import { getCurrentMembership } from "@/modules/access/application/get-current-membership";
import { listTendersBySourceIds } from "@/modules/payment/infrastructure/payments";
import { isTab, netLines, netTotal, tabRemaining, type NetLine } from "@/modules/shop/domain/booking-items";
import { listSalesOnBookings } from "@/modules/shop/infrastructure/booking-sales";

export type TabView = {
  saleId: string;
  personId: string | null;
  name: string;
  phone: string | null;
  lines: NetLine[];
  totalUsd: Decimal;
  paidUsd: Decimal;
  remainingUsd: Decimal;
};

export type BookingItemsView = {
  bookingId: string;
  /** Items "on the game": already inside the booking due. */
  gameLines: NetLine[];
  gameTotalUsd: Decimal;
  tabs: TabView[];
};

/**
 * What was put on these games, for the booking sheet: the "on the game" items and each player tab with
 * what it has paid. Two reads for any number of games. Any signed-in member who can see Today.
 */
export async function listBookingItems(bookingIds: string[]): Promise<Map<string, BookingItemsView>> {
  const membership = await getCurrentMembership();
  if (!membership) throw new DomainError("access.not_allowed");
  const unique = [...new Set(bookingIds)];
  if (unique.length === 0) return new Map();

  try {
    const sales = await listSalesOnBookings(db, unique);
    const tabIds = sales.filter(isTab).map((sale) => sale.id);
    const tenders = await listTendersBySourceIds(db, "SALE", tabIds);
    const paidBySale = new Map<string, Decimal>();
    for (const tender of tenders) {
      paidBySale.set(tender.sourceId, (paidBySale.get(tender.sourceId) ?? new Decimal(0)).plus(tender.usdEquivalent));
    }

    const result = new Map<string, BookingItemsView>();
    for (const sale of sales) {
      if (!sale.bookingId) continue;
      const view =
        result.get(sale.bookingId) ??
        ({ bookingId: sale.bookingId, gameLines: [], gameTotalUsd: new Decimal(0), tabs: [] } satisfies BookingItemsView);
      const lines = netLines(sale.lines);
      const total = netTotal(lines);
      if (!isTab(sale)) {
        view.gameLines = lines;
        view.gameTotalUsd = total;
      } else if (lines.length > 0) {
        const paid = paidBySale.get(sale.id) ?? new Decimal(0);
        view.tabs.push({
          saleId: sale.id,
          personId: sale.payerPersonId,
          name: sale.displayName ?? "",
          phone: sale.displayPhone,
          lines,
          totalUsd: total,
          paidUsd: paid,
          remainingUsd: tabRemaining(total, paid),
        });
      }
      result.set(sale.bookingId, view);
    }
    return result;
  } catch (error) {
    return await rethrowUnexpected(error, "List booking items failed", "listBookingItems");
  }
}
