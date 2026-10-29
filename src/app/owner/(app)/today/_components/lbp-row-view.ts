import Decimal from "decimal.js";
import { formatLbpAmount, formatParts, formatUsd } from "@/lib/format/money";
import { formatLocalClockRange, formatLocalHm, type HourCycle } from "@/lib/format/time";
import type { UiLocale } from "@/lib/locale";
import { formatEarlierDayLabel, formatSlotDateLabel } from "@/app/owner/(app)/today/_components/date-label";
import { gameFeeFields } from "@/app/owner/(app)/today/_components/game-fee-view";
import { perPlayerViewOf } from "@/app/owner/(app)/today/_components/per-player-view";
import type { LbpOwnerDayBooking } from "@/modules/booking/application/load-owner-day";
import type { WaitlistGroup } from "@/modules/booking/application/list-open-waitlist";
import type { SeriesInfo } from "@/modules/booking/application/load-series-info";
import { messageDayLabel, nightHint } from "@/modules/booking/application/night-hint";
import { deriveCardDisplay } from "@/modules/booking/domain/card-display";
import { classifyDue } from "@/modules/booking/domain/classify-due";
import { isCancelWindowClosed, isNoShowWindowEnded } from "@/modules/booking/domain/decision";
import { mayAddItemsToBooking } from "@/modules/booking/domain/shop-window";
import type { FeePolicy } from "@/modules/booking/domain/suggest-fee";
import type { ExtendOfferView } from "@/modules/booking/ui/extend-form";
import { upcomingStatus } from "@/modules/booking/domain/home-inbox";
import { peopleWaitingOn } from "@/modules/booking/domain/waitlist";
import type { BookingItemsPanelView } from "@/modules/booking/ui/booking-items";
import type { UpcomingRowView } from "@/modules/booking/ui/upcoming-panel";
import { seriesRowLine } from "@/modules/booking/ui/series-labels";
import { notifyLink } from "@/modules/notification/domain/whatsapp-link";
import type { BookingItemsView } from "@/modules/shop/application/list-booking-items";

/**
 * An LBP game on Today (DR-007): the card, the sheet and the WhatsApp text show its due in pounds, and
 * every action works on it: collect, "Consider it paid", the per-player split (slices 6 and 7), and the
 * cancel and no-show fees, extend, adjust, add items and repeat weekly (slice 8), all in pounds. The
 * fee, collected and due strings of the row are whole pounds (`currency` says so).
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
    /** The cancellation and no-show fee rules of the stadium. */
    policy: FeePolicy;
    /** The game may be repeated weekly (confirmed, upcoming, not in a series, member may create). */
    repeatWeekly: boolean;
    /** The Extend button's data, from the same offer as a game in dollars. */
    extend: ExtendOfferView | null;
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
  const fees = gameFeeFields({
    due: { currency: "LBP", amount: row.amountDueLbp },
    collected: row.settledLbp,
    start: row.start,
    now,
    policy: ctx.policy,
  });
  const dueState = classifyDue({ status: row.status, start: row.start, end: row.end, remaining, now });
  return {
    id: row.id,
    pitchName: ctx.showPitch ? row.pitchName : null,
    timeRange: formatLocalClockRange(row.start, row.end, hourCycle, locale),
    startMs: row.start.getTime(),
    extendedMinutes: ctx.extendedMinutes,
    repeatWeekly: ctx.repeatWeekly,
    series: ctx.series
      ? {
          seriesId: ctx.series.seriesId,
          line: seriesRowLine({ anchor: ctx.series.anchor, left: ctx.series.left, lastStart: ctx.series.lastStart, locale, hourCycle }),
          fact: seriesRowLine({ anchor: ctx.series.anchor, left: ctx.series.left, lastStart: ctx.series.lastStart, locale, hourCycle, short: true }),
        }
      : null,
    dayLabel: formatEarlierDayLabel(row.start, now, locale, dayStartHour),
    dateLabel: formatSlotDateLabel(row.start, now, locale),
    nightHint: nightHint(row.start, locale, dayStartHour),
    requesterPersonId: row.requesterPersonId,
    requesterName: row.requesterName,
    requesterPhone: row.requesterPhone,
    currency: "LBP",
    remainingUsd: zero,
    bookingOwes: remaining.gt(0),
    approved: row.status === "APPROVED",
    mayAddItems: mayAddItemsToBooking({ status: row.status, start: row.start, now }),
    items: ctx.itemsPanel,
    // The due, in whole pounds: the Adjust form starts from it.
    priceUsd: row.amountDueLbp.toFixed(0),
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
    showCancel: row.status === "APPROVED" && !isCancelWindowClosed(row.start, now),
    showNoShow: row.status === "APPROVED" && isNoShowWindowEnded(row.end, now),
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
    extend: ctx.extend,
    canAdjust: row.collectionMode === "WHOLE" && (dueState === "owed" || dueState === "expected"),
    ...fees,
    stadiumName: ctx.stadiumName,
    waDay,
    waTime,
  };
}
