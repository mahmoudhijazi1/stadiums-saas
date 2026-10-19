import type { UiLocale } from "@/lib/locale";
import { listBookingLabels } from "@/modules/booking/application/list-booking-labels";
import { listExpenseDetails } from "@/modules/expense/application/list-expense-details";
import { listSaleDetails } from "@/modules/shop/application/list-sale-details";
import { listKeptByEntry } from "@/modules/payment/application/list-kept-by-entry";
import { listLedgerActivity } from "@/modules/ledger/application/list-ledger-activity";
import { mapActivityEntry, type ActivityRowView } from "@/app/owner/(app)/money/_components/activity-map";

export type ActivityPageView = { rows: ActivityRowView[]; nextCursor: string | null };

/**
 * One Activity page: the ledger movements, then one batched read per source type for the
 * names behind them, in parallel. Composed here, in app/, so ledger never imports booking
 * or expense. Each read checks reports.view itself.
 */
export async function loadActivityPage(
  input: { from: string; to: string; filter: "all" | "in" | "out"; cursor?: string; limit?: number },
  locale: UiLocale,
): Promise<ActivityPageView> {
  const page = await listLedgerActivity(input);
  const idsOf = (sourceType: string) =>
    page.entries.filter((entry) => entry.sourceType === sourceType).map((entry) => entry.sourceId);
  const [bookings, expenses, sales, kept] = await Promise.all([
    listBookingLabels([...idsOf("BOOKING"), ...idsOf("KEPT_CHANGE")]),
    listExpenseDetails(idsOf("EXPENSE")),
    listSaleDetails(idsOf("SALE")),
    listKeptByEntry(page.entries),
  ]);
  return {
    rows: page.entries.map((entry) => mapActivityEntry(entry, { bookings, expenses, sales, kept }, locale)),
    nextCursor: page.nextCursor,
  };
}
