import type { CardDisplay } from "@/modules/booking/domain/card-display";
import type { UpcomingStatus } from "@/modules/booking/domain/home-inbox";
import type { BookingItemsPanelView } from "@/modules/booking/ui/booking-items";
import type { ExtendOfferView } from "@/modules/booking/ui/extend-form";
import type { NotifyPerson } from "@/modules/booking/ui/notify-list";
import type { PerPlayerView } from "@/modules/booking/ui/per-player-collect";

export type UpcomingRowView = {
  id: string;
  /** Null when the stadium has one pitch: the name would say nothing. */
  pitchName: string | null;
  timeRange: string;
  /** Minutes added by extensions (30 each); 0 = never extended. Shown as a mark by the time. */
  extendedMinutes: number;
  /** "Repeat weekly" is offered: confirmed, not over, not in a series, and the member may create. */
  repeatWeekly: boolean;
  /** The weekly series this game belongs to, with the line shown under the time. */
  series: { seriesId: string; line: string } | null;
  dateLabel: string;
  /** Day an owed game belongs to: "Yesterday", a weekday, or the date. */
  dayLabel: string;
  /** "night of Friday" for a 00:00–05:59 start, else null. */
  nightHint: string | null;
  requesterPersonId: string;
  requesterName: string;
  requesterPhone: string | null;
  remainingUsd: string;
  /** Unpaid player tabs on this game; shown in the pill, never collected with the booking. */
  tabsRemainingUsd: string;
  /** The booking itself still has money due (the tabs aside). */
  bookingOwes: boolean;
  /** Confirmed, so items can be put on it. */
  approved: boolean;
  items: BookingItemsPanelView;
  priceUsd: string;
  interested: NotifyPerson[];
  status: UpcomingStatus;
  display: CardDisplay;
  displayAmountUsd: string;
  /** The header WhatsApp link: the chat, or the payment reminder when money is owed on an ended game. */
  whatsAppHref: string | null;
  showCancel: boolean;
  showNoShow: boolean;
  /** "Extend 30 min": null when the member may not, or the game cannot be extended at all. */
  extend: ExtendOfferView | null;
  canAdjust: boolean;
  perPlayer: PerPlayerView;
  hoursBefore: number;
  playerFeeCompact: string | null;
  playerFeeExact: string;
  ownerFeeCompact: string | null;
  ownerFeeExact: string;
  /** "I cancelled" would store less than the player path: needs bookings.adjust_due. */
  ownerCancelLowersFee: boolean;
  noShowFeeCompact: string | null;
  noShowFeeExact: string;
  collectedExact: string;
  collectedCompact: string;
  stadiumName: string;
  waDay: string;
  waTime: string;
};

export function owesCash(row: UpcomingRowView): boolean {
  if (row.status === "paid" || !row.bookingOwes) return false;
  return (
    row.display.kind === "unpaid" ||
    row.display.kind === "partial" ||
    row.display.kind === "no_show_unpaid" ||
    row.display.kind === "cancelled"
  );
}

/** The game is split per player. */
export function isPerPlayer(row: UpcomingRowView): boolean {
  return row.perPlayer.mode === "PER_PLAYER";
}

/**
 * The same rules as before, only the place changed: the split switch needs adjust rights and a
 * game that is split already or may be split now.
 */
export function splitAdjustOf(row: UpcomingRowView, mayAdjust: boolean): boolean {
  return mayAdjust && (isPerPlayer(row) || owesCash(row));
}
