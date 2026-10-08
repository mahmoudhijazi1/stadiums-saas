import Decimal from "decimal.js";
import { formatDisplayDate } from "@/lib/format-display-date";
import type { UiLocale } from "@/lib/locale";
import { ui } from "@/lib/ui-copy";
import type { BookingLabel } from "@/modules/booking/application/list-booking-labels";
import type { ExpenseDetail } from "@/modules/expense/application/list-expense-details";
import type { LedgerEntryRow } from "@/modules/ledger/infrastructure/entries";
import { addCalendarDays, civilDateInTimeZone, formatCivilDate } from "@/modules/venue/domain/availability";

const TZ = "Asia/Beirut";

export type ExpenseDetailView = {
  amountUsd: string;
  categoryLabel: string;
  description: string;
  dateLabel: string;
  tenders: { currency: "USD" | "LBP"; amount: string; rate: string | null; usd: string }[];
};

/** One Activity row, plain data (it crosses to the client list). */
export type ActivityRowView = {
  id: string;
  direction: "IN" | "OUT";
  amountUsd: string;
  occurredAt: string;
  /** Beirut calendar day, `YYYY-MM-DD`. */
  day: string;
  label: string;
  secondary: string;
  icon: "booking" | "expense" | "generic";
  /** What a tap opens: a game on Today, an expense sheet, or nothing. */
  open: { kind: "link"; href: string } | { kind: "expense"; detail: ExpenseDetailView } | null;
};

export type ActivityContext = {
  bookings: ReadonlyMap<string, BookingLabel>;
  expenses: ReadonlyMap<string, ExpenseDetail>;
};

type Parts = Pick<ActivityRowView, "label" | "secondary" | "icon" | "open">;
type Mapper = (entry: LedgerEntryRow, context: ActivityContext, locale: UiLocale) => Parts;

function fullDate(value: Date, locale: UiLocale): string {
  return formatDisplayDate(value, locale, { day: "numeric", month: "short", year: "numeric" }, TZ);
}

function mapBooking(entry: LedgerEntryRow, context: ActivityContext, locale: UiLocale): Parts {
  const booking = context.bookings.get(entry.sourceId);
  return {
    label: booking?.requesterName ?? ui("owner.activityPlayer", locale),
    secondary: ui("owner.activityGame", locale),
    icon: "booking",
    open: booking
      ? { kind: "link", href: `/owner/today?date=${booking.businessDay}&highlight=${booking.id}&open=1` }
      : null,
  };
}

function mapExpense(entry: LedgerEntryRow, context: ActivityContext, locale: UiLocale): Parts {
  const expense = context.expenses.get(entry.sourceId);
  if (!expense) {
    return { label: ui("owner.activityExpense", locale), secondary: "", icon: "expense", open: null };
  }
  const category = ui(`cat.${expense.category}`, locale);
  return {
    label: expense.description.trim() || category,
    secondary: category,
    icon: "expense",
    open: {
      kind: "expense",
      detail: {
        amountUsd: entry.amountUsd.toFixed(2),
        categoryLabel: category,
        description: expense.description,
        dateLabel: fullDate(expense.occurredAt, locale),
        tenders: expense.tenders.map((tender) => ({
          currency: tender.currency,
          amount: tender.currency === "USD" ? tender.amount.toFixed(2) : tender.amount.toFixed(0),
          rate: tender.rateAtTime ? tender.rateAtTime.toFixed(0) : null,
          usd: tender.usdEquivalent.toFixed(2),
        })),
      },
    },
  };
}

/** A source type nobody has taught this screen yet (a future shop, say): still shown, never dropped. */
function mapGeneric(_entry: LedgerEntryRow, _context: ActivityContext, locale: UiLocale): Parts {
  return { label: ui("owner.activityGeneric", locale), secondary: "", icon: "generic", open: null };
}

/** One mapping keyed by ledger sourceType: label, secondary text, icon and what a tap opens. */
const MAPPERS: Record<string, Mapper> = { BOOKING: mapBooking, EXPENSE: mapExpense };

export function mapActivityEntry(entry: LedgerEntryRow, context: ActivityContext, locale: UiLocale): ActivityRowView {
  const mapper = Object.hasOwn(MAPPERS, entry.sourceType) ? MAPPERS[entry.sourceType]! : mapGeneric;
  return {
    id: entry.id,
    direction: entry.direction,
    amountUsd: entry.amountUsd.toFixed(2),
    occurredAt: entry.occurredAt.toISOString(),
    day: formatCivilDate(civilDateInTimeZone(entry.occurredAt, TZ)),
    ...mapper(entry, context, locale),
  };
}

/** "Today", "Yesterday", or weekday + date ("Friday, 9 Oct"). */
export function dayHeading(day: string, now: Date, locale: UiLocale): string {
  const today = civilDateInTimeZone(now, TZ);
  if (day === formatCivilDate(today)) return ui("public.today", locale);
  if (day === formatCivilDate(addCalendarDays(today, -1))) return ui("owner.yesterday", locale);
  const [year, month, date] = day.split("-").map(Number) as [number, number, number];
  return formatDisplayDate(
    new Date(Date.UTC(year, month - 1, date, 12)),
    locale,
    { weekday: "long", day: "numeric", month: "short" },
    "UTC",
  );
}

/** Rows are already newest first; a group is a run of the same Beirut day. */
export function groupByDay(rows: readonly ActivityRowView[]): { day: string; rows: ActivityRowView[] }[] {
  const groups: { day: string; rows: ActivityRowView[] }[] = [];
  for (const row of rows) {
    const last = groups.at(-1);
    if (last && last.day === row.day) last.rows.push(row);
    else groups.push({ day: row.day, rows: [row] });
  }
  return groups;
}

export function signedAmount(direction: "IN" | "OUT", amountUsd: string): string {
  const value = new Decimal(amountUsd);
  const compact = value.toFixed(2).endsWith(".00") ? value.toFixed(0) : value.toFixed(2);
  return direction === "IN" ? `+$${compact}` : `−$${compact}`;
}
