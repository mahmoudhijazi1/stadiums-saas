import Link from "next/link";
import { Bell, ChevronRight, Repeat } from "lucide-react";
import { Suspense } from "react";
import { FreeStripSection } from "@/app/owner/(app)/today/_components/free-strip-section";
import type { CurrentMembership } from "@/modules/access/application/get-current-membership";
import { BOOKINGS_ADJUST_DUE, BOOKINGS_CANCEL, BOOKINGS_CREATE, BOOKINGS_NO_SHOW, PAYMENTS_COLLECT, can } from "@/modules/access/domain/can";
import { loadSeriesCreated } from "@/modules/booking/application/load-series-created";
import { loadSeriesInfo, type SeriesInfo } from "@/modules/booking/application/load-series-info";
import { endingSoon, listWeeklyBookings } from "@/modules/booking/application/list-weekly-bookings";
import { seriesRowLine, weeklyWeekdayAndTime } from "@/modules/booking/ui/series-labels";
import { SeriesCreatedSheet } from "@/modules/booking/ui/weekly-confirm";
import { listExtensionMinutes } from "@/modules/booking/application/list-extension-minutes";
import { loadExtensionOffers, type ExtensionOffer } from "@/modules/booking/application/load-extension-offers";
import {
  loadOwnerDay,
  type OwnerDayBooking,
} from "@/modules/booking/application/load-owner-day";
import { listOpenWaitlist } from "@/modules/booking/application/list-open-waitlist";
import { listPendingRequests } from "@/modules/booking/application/list-pending-requests";
import { actionablePending } from "@/modules/booking/domain/expired-request";
import { classifyDue } from "@/modules/booking/domain/classify-due";
import { extendView } from "@/app/owner/(app)/today/_components/extend-view";
import { gameFeeFields } from "@/app/owner/(app)/today/_components/game-fee-view";
import { perPlayerViewOf } from "@/app/owner/(app)/today/_components/per-player-view";
import { hasSeveralPitches } from "@/modules/venue/application/has-several-pitches";
import { getCurrentRate } from "@/modules/payment/application/get-current-rate";
import { peopleWaitingOn } from "@/modules/booking/domain/waitlist";
import { deriveCardDisplay } from "@/modules/booking/domain/card-display";
import Decimal from "decimal.js";
import { formatLocalHm } from "@/lib/format/time";
import { formatUsd, formatUsdCompact } from "@/lib/format/money";
import type { UiLocale } from "@/lib/locale";
import { dayStartClock, ui } from "@/lib/copy";
import { formatEarlierDayLabel, formatSlotDateLabel } from "@/app/owner/(app)/today/_components/date-label";
import { businessDate } from "@/modules/booking/domain/business-day";
import { compareCivilDate } from "@/modules/venue/domain/availability";
import { mayAddItemsToBooking } from "@/modules/booking/domain/shop-window";
import { OwnerDayStrip } from "@/modules/booking/ui/day-strip";
import { DayContent, DayNavProvider } from "@/modules/booking/ui/day-nav";
import { formatCivilDate } from "@/modules/venue/domain/availability";
import {
  messageDayLabel,
  nightHint,
} from "@/modules/booking/application/night-hint";
import { UpcomingPanel, type UpcomingRowView } from "@/modules/booking/ui/upcoming-panel";
import type { BookingItemsPanelView, ItemLineView } from "@/modules/booking/ui/booking-items";
import { listBookingItems, type BookingItemsView } from "@/modules/shop/application/list-booking-items";
import { listProducts } from "@/modules/shop/application/products";
import { formatParts } from "@/lib/format/money";
import { notifyLink } from "@/modules/notification/domain/whatsapp-link";
import { SHOP_SELL } from "@/modules/access/domain/can";
import type { NetLine } from "@/modules/shop/domain/booking-items";
import { formatLocalClock, formatLocalClockRange, type HourCycle } from "@/lib/format/time";
import { getCurrentTenant } from "@/lib/tenant-context";
import {
  loadOutcomeNotify,
  type OutcomeKind,
} from "@/modules/booking/application/load-outcome-notify";
import { upcomingStatus } from "@/modules/booking/domain/home-inbox";
import type { WaitlistGroup } from "@/modules/booking/application/list-open-waitlist";
import { isCancelWindowClosed, isNoShowWindowEnded } from "@/modules/booking/domain/decision";
import { ClockText } from "@/components/ui/ltr-isolate";
import { LiveRequestCount } from "@/modules/booking/ui/live-queue";
import { loadSeriesSheetAction, previewCancelRestAction, previewSeriesAction, submitCancelRest, submitSeriesSave } from "@/app/owner/(app)/series/actions";
import { submitAddBookingItems, submitCollectTab, submitRemoveBookingItem, submitWalkInSale } from "@/app/owner/(app)/today/items-actions";
import { submitAdjustBookingDue, submitCancelBooking, submitCollectAllRemaining, submitCollectPayment, submitCollectSlot, submitConsiderPaid, submitConsiderSharePaid, submitRecordNoShow, submitSwitchToPerPlayer, submitSwitchToWhole } from "@/app/owner/(app)/today/actions";
import { submitExtendBooking } from "@/app/owner/(app)/today/extend-actions";
import { lbpUpcomingView } from "@/app/owner/(app)/today/_components/lbp-row-view";

export async function OwnerToday({
  membership,
  locale = "ar",
  highlight,
  openHighlight = false,
  date,
  notify,
  bookingId,
  series,
  skipped,
}: {
  membership: CurrentMembership;
  locale?: UiLocale;
  highlight?: string;
  openHighlight?: boolean;
  date?: string;
  notify?: OutcomeKind;
  bookingId?: string;
  /** A weekly series just booked from the quick-booking sheet, and the weeks skipped (ISO, comma). */
  series?: string;
  skipped?: string;
}) {
  const tenant = await getCurrentTenant();
  const hourCycle: HourCycle = tenant.timeDisplay;
  const ownerDay = await loadOwnerDay(date);
  const showPitch = await hasSeveralPitches();
  const rate = await getCurrentRate();
  const openWaitlist = await listOpenWaitlist();
  const now = new Date();
  const pending = ownerDay.isToday
    ? actionablePending(await listPendingRequests(), now)
    : [];
  const mayCollect = can(membership, PAYMENTS_COLLECT);
  const mayCancel = can(membership, BOOKINGS_CANCEL);
  const mayNoShow = can(membership, BOOKINGS_NO_SHOW);
  const mayAdjust = can(membership, BOOKINGS_ADJUST_DUE);
  // "Extend 30 min": a preview per game, empty for a member without bookings.extend. A game in
  // pounds is priced in pounds (DR-007 slice 8).
  const extensionOffers = await loadExtensionOffers(
    ownerDay.games.map((row) => ({
      id: row.id,
      status: row.status,
      pitchId: row.pitchId,
      start: row.start,
      end: row.end,
      price:
        row.currency === "LBP"
          ? { currency: "LBP" as const, amount: row.priceLbp }
          : { currency: "USD" as const, amount: row.priceUsd },
      collectionMode: row.collectionMode,
    })),
    now,
  );
  const policy = {
    cancellationWindowHours: tenant.cancellationWindowHours,
    lateCancellationFeePercent: tenant.lateCancellationFeePercent,
    noShowFeePercent: tenant.noShowFeePercent,
  };
  const earliest = pending[0];
  // Games from earlier business days that are still owed. Today's own ended games stay in Games.
  const earlierDebts = ownerDay.isToday
    ? ownerDay.toCollect.filter(
        (row) => compareCivilDate(businessDate(row.start, tenant.dayStartHour), ownerDay.today) < 0,
      )
    : [];
  // The shop on these games: items and tabs in one read, the catalog once (only for members who sell).
  const maySell = can(membership, SHOP_SELL);
  const [itemsByBooking, products] = await Promise.all([
    listBookingItems([...ownerDay.games, ...earlierDebts].map((row) => row.id)),
    maySell ? listProducts({ forSale: true }) : Promise.resolve([]),
  ]);
  const shop = {
    maySell,
    products: products.map((item) => ({
      id: item.id,
      name: item.name,
      currency: item.priceCurrency,
      price: item.priceCurrency === "LBP" ? item.priceLbp!.toFixed(0) : item.priceUsd!.toFixed(2),
    })),
  };
  // The "+30" mark next to the time of a game that was extended.
  const extendedMinutes = await listExtensionMinutes([...ownerDay.games, ...earlierDebts].map((row) => row.id));
  // Weekly series: which of these games already belong to one, and the result sheet after booking.
  const seriesInfo = await loadSeriesInfo([...ownerDay.games, ...earlierDebts].map((row) => row.id), now);
  const mayCreate = can(membership, BOOKINGS_CREATE);
  const repeatable = new Set(
    mayCreate
      ? ownerDay.games
          .filter(
            (row) =>
              row.status === "APPROVED" &&
              row.end.getTime() > now.getTime() &&
              !seriesInfo.has(row.id),
          )
          .map((row) => row.id)
      : [],
  );
  // One aggregate query: the weekly bookings with 2 games left or fewer (the reminder line).
  const soon = ownerDay.isToday && mayCreate ? endingSoon(await listWeeklyBookings({ now })) : [];
  const seriesCreated = series
    ? await loadSeriesCreated({
        seriesId: series,
        skippedStarts: (skipped ?? "")
          .split(",")
          .filter(Boolean)
          .map((value) => new Date(value))
          .filter((value) => !Number.isNaN(value.getTime())),
        locale,
        hourCycle,
        stadiumName: tenant.name,
      })
    : null;
  const saved =
    notify && bookingId ? await loadOutcomeNotify({ bookingId, kind: notify }) : null;

  return (
    <DayNavProvider selected={formatCivilDate(ownerDay.day)}>
      <OwnerDayStrip day={ownerDay.day} today={ownerDay.today} locale={locale} />
      <DayContent date={formatCivilDate(ownerDay.day)}>
      {ownerDay.isToday && ownerDay.afterMidnight ? (
        <p className="text-center text-xs text-muted-foreground">
          {ui("owner.afterMidnightToday", locale).replace("{time}", dayStartClock(tenant.dayStartHour, locale))}
        </p>
      ) : null}

      {ownerDay.isToday && pending.length > 0 && earliest ? (
        <Link
          href="/owner/requests"
          className="flex min-h-14 w-full items-center gap-3 rounded-xl border bg-card px-4 py-3 text-sm font-semibold outline-none hover:bg-muted/60 focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <Bell aria-hidden className="size-5 shrink-0" />
          <span className="min-w-0 flex-1">
            <LiveRequestCount fallback={pending.length} locale={locale} />
            <span aria-hidden> · </span>
            <ClockText text={formatLocalClock(earliest.start, hourCycle, locale)} />
          </span>
          <ChevronRight
            aria-hidden
            className="size-5 shrink-0 text-muted-foreground rtl:rotate-180"
          />
        </Link>
      ) : null}

      {soon.length > 0 ? (
        <Link
          href="/owner/more/weekly"
          className="flex min-h-12 w-full items-center gap-3 rounded-xl border bg-card px-4 py-2 type-label outline-none hover:bg-muted/60 focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <Repeat aria-hidden className="size-5 shrink-0" />
          <span className="min-w-0 flex-1">
            {soon.length === 1
              ? (() => {
                  const when = weeklyWeekdayAndTime(soon[0]!.anchor, locale, hourCycle);
                  return ui("owner.weeklyEndingOne", locale)
                    .replace("{name}", soon[0]!.personName)
                    .replace("{weekday}", when.weekday)
                    .replace("{time}", when.time);
                })()
              : ui("owner.weeklyEndingMany", locale).replace("{n}", String(soon.length))}
          </span>
          <ChevronRight aria-hidden className="size-5 shrink-0 text-muted-foreground rtl:rotate-180" />
        </Link>
      ) : null}

      <UpcomingPanel
        collectActions={{
          submitCollectPayment,
          submitConsiderPaid,
          submitConsiderSharePaid,
          submitSwitchToPerPlayer,
          submitSwitchToWhole,
          submitCollectSlot,
          submitCollectAllRemaining,
        }}
        extendActions={{ submitExtendBooking }}
        itemsActions={{ submitAddBookingItems, submitWalkInSale, submitCollectTab, submitRemoveBookingItem }}
        seriesActions={{
          loadSeriesSheetAction,
          previewCancelRestAction,
          previewSeriesAction,
          submitCancelRest,
          submitSeriesSave,
        }}
        feeActions={{ submitCancelBooking, submitRecordNoShow, submitAdjustBookingDue }}
        toCollect={toUpcomingViews(
          earlierDebts,
          itemsByBooking,
          now,
          locale,
          hourCycle,
          openWaitlist,
          policy,
          tenant.name,
          showPitch,
          tenant.perPlayerSplitEnabled,
          tenant.dayStartHour,
          undefined,
          false,
          extendedMinutes,
        )}
        toCollectHasMore={ownerDay.isToday && ownerDay.toCollectHasMore}
        toCollectUsd={ownerDay.toCollectOwed.usd.toFixed(2)}
        toCollectLbp={ownerDay.toCollectOwed.lbp.toFixed(0)}
        free={
          <Suspense key="free-strip" fallback={null}>
            <FreeStripSection membership={membership} locale={locale} date={date} />
          </Suspense>
        }
        games={toUpcomingViews(
          ownerDay.games,
          itemsByBooking,
          now,
          locale,
          hourCycle,
          openWaitlist,
          policy,
          tenant.name,
          showPitch,
          tenant.perPlayerSplitEnabled,
          tenant.dayStartHour,
          extensionOffers,
          mayAdjust,
          extendedMinutes,
          repeatable,
          seriesInfo,
        )}
        locale={locale}
        mayCollect={mayCollect}
        mayCancel={mayCancel}
        mayNoShow={mayNoShow}
        mayAdjust={mayAdjust}
        highlight={highlight}
        openHighlight={openHighlight}
        saved={saved}
        date={date}
        lbpPerUsd={rate ? rate.toString() : null}
        shop={shop}
      />
      {seriesCreated ? (
        <SeriesCreatedSheet
          summary={seriesCreated}
          skippedLabels={seriesCreated.skippedLabels}
          locale={locale}
          closeHref={date ? `/owner/today?date=${encodeURIComponent(date)}` : "/owner/today"}
        />
      ) : null}
      </DayContent>
    </DayNavProvider>
  );
}

function lineViews(lines: readonly NetLine[]): ItemLineView[] {
  return lines.map((line) => ({
    id: line.id,
    name: line.name,
    qty: line.qty,
    // In the currency of the item: an LBP item is shown in pounds, whatever the rate did since.
    currency: line.unitPriceLbp ? ("LBP" as const) : ("USD" as const),
    unit: line.unitPriceLbp ? line.unitPriceLbp.toFixed(0) : formatUsd(line.unitPriceUsd),
    total: line.totalLbp ? line.totalLbp.toFixed(0) : formatUsd(line.totalUsd),
  }));
}

function itemsView(row: OwnerDayBooking, items: BookingItemsView | undefined, now: Date): BookingItemsPanelView {
  return {
    // The rule that already decides when a tab counts as owed (see summarizeOwed / summarizeDay).
    tabsOwed: classifyDue({ status: row.status, start: row.start, end: row.end, remaining: new Decimal(1), now }) === "owed",
    bookerPersonId: row.requesterPersonId,
    bookerName: row.requesterName,
    tabs: (items?.tabs ?? []).map((tab) => ({
      saleId: tab.saleId,
      personId: tab.personId,
      name: tab.name,
      lines: lineViews(tab.lines),
      paidUsd: formatUsd(tab.paidUsd),
      remainingLbp: tab.remainingLbp.toFixed(0),
      remainingUsd: formatUsd(tab.remainingUsd),
    })),
  };
}

function toUpcomingViews(
  rows: OwnerDayBooking[],
  itemsByBooking: Map<string, BookingItemsView>,
  now: Date,
  locale: UiLocale,
  hourCycle: HourCycle,
  openWaitlist: WaitlistGroup[],
  policy: {
    cancellationWindowHours: number;
    lateCancellationFeePercent: number;
    noShowFeePercent: number;
  },
  stadiumName: string,
  showPitch: boolean,
  splitEnabled: boolean,
  dayStartHour: number,
  extensionOffers: Map<string, ExtensionOffer> = new Map(),
  mayEditExtension = false,
  extendedMinutes: Map<string, number> = new Map(),
  repeatable: Set<string> = new Set(),
  seriesInfo: Map<string, SeriesInfo> = new Map(),
): UpcomingRowView[] {
  return rows.map((row) => {
    if (row.currency === "LBP") {
      return lbpUpcomingView(row, {
        items: itemsByBooking.get(row.id),
        itemsPanel: itemsView(row, itemsByBooking.get(row.id), now),
        now,
        locale,
        hourCycle,
        openWaitlist,
        stadiumName,
        showPitch,
        dayStartHour,
        extendedMinutes: extendedMinutes.get(row.id) ?? 0,
        series: seriesInfo.get(row.id),
        splitEnabled,
        policy,
        repeatWeekly: repeatable.has(row.id),
        extend: extendView(row, extensionOffers.get(row.id), hourCycle, locale, mayEditExtension),
      });
    }
    // The pill, the card state and the owed class count the player tabs too; the Collect amounts
    // below (remainingUsd) stay the booking only.
    const display = deriveCardDisplay({
      start: row.start,
      end: row.end,
      price: row.amountDueUsd.plus(row.tabsRemainingUsd),
      remaining: row.remaining.plus(row.tabsRemainingUsd),
      now,
      status: row.status,
    });
    const fees = gameFeeFields({
      due: { currency: "USD", amount: row.amountDueUsd },
      collected: row.collectedUsd,
      start: row.start,
      now,
      policy,
    });
    const due = classifyDue({
      status: row.status,
      start: row.start,
      end: row.end,
      remaining: row.remaining,
      now,
    });
    const waDay = messageDayLabel(row.start, locale, dayStartHour);
    const waTime = formatLocalHm(row.start, "Asia/Beirut", hourCycle, locale);
    // The header icon: plain chat, unless the game has ended and money is owed on it (the game due or
    // any tab), then the payment reminder. `messageIntentFor("booking_header")` decides.
    const tabs = itemsByBooking.get(row.id)?.tabs ?? [];
    const owedParts = {
      usd: Decimal.max(row.remaining, 0).plus(tabs.reduce((sum, tab) => sum.plus(tab.remainingUsd), new Decimal(0))),
      lbp: tabs.reduce((sum, tab) => sum.plus(tab.remainingLbp), new Decimal(0)),
    };
    const whatsApp = notifyLink({
      context: "booking_header",
      state: {
        gameEnded: classifyDue({ status: row.status, start: row.start, end: row.end, remaining: new Decimal(1), now }) === "owed",
        owed: owedParts.usd.gt(0) || owedParts.lbp.gt(0),
      },
      phone: row.requesterPhone,
      facts: { name: row.requesterName, stadiumName, day: waDay, time: waTime, amount: formatParts(owedParts, locale) },
      locale,
    });
    return {
      id: row.id,
      pitchName: showPitch ? row.pitchName : null,
      timeRange: formatLocalClockRange(row.start, row.end, hourCycle, locale),
      extendedMinutes: extendedMinutes.get(row.id) ?? 0,
      repeatWeekly: repeatable.has(row.id),
      series: (() => {
        const info = seriesInfo.get(row.id);
        return info
          ? {
              seriesId: info.seriesId,
              line: seriesRowLine({ anchor: info.anchor, left: info.left, lastStart: info.lastStart, locale, hourCycle }),
            }
          : null;
      })(),
      dayLabel: formatEarlierDayLabel(row.start, now, locale, dayStartHour),
      dateLabel: formatSlotDateLabel(row.start, now, locale),
      nightHint: nightHint(row.start, locale, dayStartHour),
      requesterPersonId: row.requesterPersonId,
      requesterName: row.requesterName,
      requesterPhone: row.requesterPhone,
      remainingUsd: formatUsd(row.remaining),
      bookingOwes: row.remaining.gt(0),
      approved: row.status === "APPROVED",
      mayAddItems: mayAddItemsToBooking({ status: row.status, start: row.start, now }),
      items: itemsView(row, itemsByBooking.get(row.id), now),
      priceUsd: formatUsd(row.amountDueUsd),
      interested:
        row.status === "CANCELLED"
          ? peopleWaitingOn(openWaitlist, row, row.requesterPersonId)
          : [],
      status: upcomingStatus(row.start, row.remaining.plus(row.tabsRemainingUsd), now),
      display,
      displayAmountUsd:
        display.kind === "before"
          ? formatUsdCompact(row.priceUsd)
          : formatUsdCompact(row.owedUsd),
      tabsRemainingUsd: formatUsd(row.tabsRemainingUsd),
      whatsAppHref: whatsApp.href,
      showCancel:
        row.status === "APPROVED" &&
        !isCancelWindowClosed(row.start, now),
      showNoShow:
        row.status === "APPROVED" && isNoShowWindowEnded(row.end, now),
      perPlayer: perPlayerViewOf({
        bookingId: row.id,
        currency: "USD",
        mode: row.collectionMode,
        canSplit: splitEnabled && row.status === "APPROVED" && row.amountDueUsd.gt(0),
        defaultPlayerCount: row.pitchDefaultPlayerCount,
        slots: row.slots,
        due: row.amountDueUsd,
        collected: row.collectedUsd,
        unassigned: row.unassignedUsd,
      }),
      extend: extendView(row, extensionOffers.get(row.id), hourCycle, locale, mayEditExtension),
      canAdjust:
        row.collectionMode === "WHOLE" &&
        (due === "owed" || due === "expected"),
      ...fees,
      stadiumName,
      waDay,
      waTime,
    };
  });
}
