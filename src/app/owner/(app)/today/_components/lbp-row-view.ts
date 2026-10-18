import Decimal from "decimal.js";
import { formatLbpAmount, formatParts, formatUsd, formatUsdCompact } from "@/lib/format/money";
import { formatLocalClockRange, formatLocalHm, type HourCycle } from "@/lib/format/time";
import type { UiLocale } from "@/lib/locale";
import { formatEarlierDayLabel, formatSlotDateLabel } from "@/app/owner/(app)/today/_components/date-label";
import { perPlayerViewOf } from "@/app/owner/(app)/today/_components/per-player-view";
import type { LbpOwnerDayBooking } from "@/modules/booking/application/load-owner-day";
import type { WaitlistGroup } from "@/modules/booking/application/list-open-waitlist";
import type { SeriesInfo } from "@/modules/booking/application/load-series-info";
import { messageDayLabel, nightHint } from "@/modules/booking/application/night-hint";
import { deriveCardDisplay } from "@/modules/booking/domain/card-display";
import { classifyDue } from "@/modules/booking/domain/classify-due";
import { upcomingStatus } from "@/modules/booking/domain/home-inbox";
import { peopleWaitingOn } from "@/modules/booking/domain/waitlist";
import type { BookingItemsPanelView } from "@/modules/booking/ui/booking-items";
import type { UpcomingRowView } from "@/modules/booking/ui/upcoming-panel";
import { seriesRowLine } from "@/modules/booking/ui/series-labels";
import { notifyLink } from "@/modules/notification/domain/whatsapp-link";
import type { BookingItemsView } from "@/modules/shop/application/list-booking-items";

/**
 * An LBP game on Today (DR-007): the card, the sheet and the WhatsApp text show its due in pounds.
 * Collect, "Consider it paid" and the per-player split work on it (slices 6 and 7); the other money
 * actions (fees on cancel and no-show, adjust, extend, add items, repeat weekly) are hidden, because
 * each one is refused (booking.lbp_not_supported) until its slice lands.
 */
export function lbpUpcomingView(
  row: LbpOwnerDayBooking,
  ctx: {
    items: BookingItemsView | undefined;
    /** The items panel, built by the page like any game's. */
    itemsPanel: BookingItemsPanelView;
    now: Date;
    locale: UiLocale;
    hourCycle: HourCycle;
    openWaitlist: WaitlistGroup[];
    stadiumName: string;
    showPitch: boolean;
    dayStartHour: number;
    extendedMinutes: number;
    series: SeriesInfo | undefined;
    /** The stadium allows splitting a game per player. */
    splitEnabled: boolean;
  },
): UpcomingRowView {
  const { now, locale, hourCycle, dayStartHour } = ctx;
  // What is left in pounds: the due minus what the game's settlements applied (DR-007).
  const remaining = row.remainingLbp;
  const display = deriveCardDisplay({
    start: row.start,
    end: row.end,
    price: row.amountDueLbp,
    remaining,
    now,
    status: row.status,
  });
  const waDay = messageDayLabel(row.start, locale, dayStartHour);
  const waTime = formatLocalHm(row.start, "Asia/Beirut", hourCycle, locale);
  const tabs = ctx.items?.tabs ?? [];
  const tabsLbp = tabs.reduce((sum, tab) => sum.plus(tab.remainingLbp), new Decimal(0));
  // The game's pounds and any player tab, each in its own currency (never added through a rate).
  const owedParts = {
    usd: tabs.reduce((sum, tab) => sum.plus(tab.remainingUsd), new Decimal(0)),
    lbp: row.owedLbp.plus(tabsLbp),
  };
  const whatsApp = notifyLink({
    context: "booking_header",
    state: {
      gameEnded: classifyDue({ status: row.status, start: row.start, end: row.end, remaining: new Decimal(1), now }) === "owed",
      owed: owedParts.usd.gt(0) || owedParts.lbp.gt(0),
    },
    phone: row.requesterPhone,
    facts: { name: row.requesterName, stadiumName: ctx.stadiumName, day: waDay, time: waTime, amount: formatParts(owedParts, locale) },
    locale,
  });
  const zero = formatUsd(new Decimal(0));
  return {
    id: row.id,
    pitchName: ctx.showPitch ? row.pitchName : null,
    timeRange: formatLocalClockRange(row.start, row.end, hourCycle, locale),
    extendedMinutes: ctx.extendedMinutes,
    repeatWeekly: false,
    series: ctx.series
      ? {
          seriesId: ctx.series.seriesId,
          line: seriesRowLine({ anchor: ctx.series.anchor, left: ctx.series.left, lastStart: ctx.series.lastStart, locale, hourCycle }),
        }
      : null,
    dayLabel: formatEarlierDayLabel(row.start, now, locale, dayStartHour),
    dateLabel: formatSlotDateLabel(row.start, now, locale),
    nightHint: nightHint(row.start, locale, dayStartHour),
    requesterPersonId: row.requesterPersonId,
    requesterName: row.requesterName,
    requesterPhone: row.requesterPhone,
    remainingUsd: zero,
    bookingOwes: remaining.gt(0),
    approved: row.status === "APPROVED",
    mayAddItems: false,
    items: ctx.itemsPanel,
    priceUsd: zero,
    lbp: {
      due: formatLbpAmount(Decimal.max(remaining, 0), locale),
      paid: formatLbpAmount(row.settledLbp, locale),
      settled: remaining.lte(0),
      pill: formatParts(owedParts, locale),
      remaining: Decimal.max(remaining, 0).toFixed(0),
    },
    interested: row.status === "CANCELLED" ? peopleWaitingOn(ctx.openWaitlist, row, row.requesterPersonId) : [],
    status: upcomingStatus(row.start, row.owedLbp.plus(row.tabsRemainingUsd), now),
    display,
    displayAmountUsd: zero,
    tabsRemainingUsd: formatUsd(row.tabsRemainingUsd),
    whatsAppHref: whatsApp.href,
    showCancel: false,
    showNoShow: false,
    perPlayer: perPlayerViewOf({
      bookingId: row.id,
      currency: "LBP",
      mode: row.collectionMode,
      canSplit: ctx.splitEnabled && row.status === "APPROVED" && row.amountDueLbp.gt(0),
      defaultPlayerCount: row.pitchDefaultPlayerCount,
      slots: row.slots,
      due: row.amountDueLbp,
      collected: row.settledLbp,
      unassigned: row.unassignedLbp,
    }),
    extend: null,
    canAdjust: false,
    hoursBefore: Math.max(0, Math.floor((row.start.getTime() - now.getTime()) / 3_600_000)),
    playerFeeCompact: null,
    playerFeeExact: zero,
    ownerFeeCompact: null,
    ownerFeeExact: zero,
    ownerCancelLowersFee: false,
    noShowFeeCompact: null,
    noShowFeeExact: zero,
    collectedExact: zero,
    collectedCompact: formatUsdCompact(new Decimal(0)),
    stadiumName: ctx.stadiumName,
    waDay,
    waTime,
  };
}
