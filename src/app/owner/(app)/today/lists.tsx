import Link from "next/link";
import { Bell, ChevronRight } from "lucide-react";
import { Suspense } from "react";
import { FreeStripSection } from "./free-strip-section";
import type { CurrentMembership } from "@/modules/access/application/get-current-membership";
import { BOOKINGS_ADJUST_DUE, BOOKINGS_CANCEL, BOOKINGS_NO_SHOW, PAYMENTS_COLLECT, can } from "@/modules/access/domain/can";
import {
  loadOwnerDay,
  type OwnerDayBooking,
} from "@/modules/booking/application/load-owner-day";
import { listOpenWaitlist } from "@/modules/booking/application/list-open-waitlist";
import { listPendingRequests } from "@/modules/booking/application/list-pending-requests";
import { actionablePending } from "@/modules/booking/domain/expired-request";
import { classifyDue } from "@/modules/booking/domain/classify-due";
import {
  confirmedFee,
  ownerInitiatorLowersFee,
  suggestFee,
} from "@/modules/booking/domain/suggest-fee";
import { planSlotCharge, slotPayState } from "@/modules/booking/domain/slot-charge";
import { hasSeveralPitches } from "@/modules/venue/application/has-several-pitches";
import { getCurrentRate } from "@/modules/payment/application/get-current-rate";
import { peopleWaitingOn } from "@/modules/booking/domain/waitlist";
import { deriveCardDisplay } from "@/modules/booking/domain/card-display";
import type { DaySummary } from "@/modules/booking/domain/day-summary";
import Decimal from "decimal.js";
import { formatLocalHm } from "@/lib/format-local-hm";
import { formatUsd, formatUsdCompact } from "@/lib/money";
import type { UiLocale } from "@/lib/locale";
import { dayStartClock, ui, uiCount } from "@/lib/ui-copy";
import { formatEarlierDayLabel, formatSlotDateLabel } from "./date-label";
import { businessDate } from "@/modules/booking/domain/business-day";
import { compareCivilDate } from "@/modules/venue/domain/availability";
import { OwnerDayStrip } from "./day-strip";
import { DayContent, DayNavProvider } from "./day-nav";
import { formatCivilDate } from "@/modules/venue/domain/availability";
import {
  messageDayLabel,
  nightHint,
} from "@/modules/booking/application/night-hint";
import { UpcomingPanel, type UpcomingRowView } from "./upcoming-panel";
import {
  formatLocalClock,
  formatLocalClockRange,
  type HourCycle,
} from "@/app/owner/shared";
import { getCurrentTenant } from "@/lib/tenant-context";
import {
  loadOutcomeNotify,
  type OutcomeKind,
} from "@/modules/booking/application/load-outcome-notify";
import { upcomingStatus } from "@/modules/booking/domain/home-inbox";
import type { WaitlistGroup } from "@/modules/booking/application/list-open-waitlist";
import { isCancelWindowClosed, isNoShowWindowEnded } from "@/modules/booking/domain/decision";
import { ClockText, LtrIsolate } from "@/components/ui/ltr-isolate";
import { LiveRequestCount } from "@/app/owner/live-queue";

export async function OwnerToday({
  membership,
  locale = "ar",
  highlight,
  openHighlight = false,
  date,
  notify,
  bookingId,
}: {
  membership: CurrentMembership;
  locale?: UiLocale;
  highlight?: string;
  openHighlight?: boolean;
  date?: string;
  notify?: OutcomeKind;
  bookingId?: string;
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
  const earlierTotal = earlierDebts.reduce(
    (sum, row) => sum.plus(row.remaining),
    new Decimal(0),
  );
  const { summary } = ownerDay;
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

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <DaySummaryLine summary={summary} locale={locale} />
        {earlierDebts.length > 0 ? (
          <a
            href="#earlier-debts"
            className="inline-flex min-h-8 items-center gap-1 rounded-full border border-owed/60 bg-owed-subtle px-3 text-xs font-semibold text-owed outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <LtrIsolate>{`$${formatUsdCompact(earlierTotal)}${ownerDay.toCollectHasMore ? "+" : ""}`}</LtrIsolate>
            <span>{ui("owner.owedFromEarlier", locale)}</span>
          </a>
        ) : null}
      </div>

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

      <UpcomingPanel
        toCollect={toUpcomingViews(
          earlierDebts,
          now,
          locale,
          hourCycle,
          openWaitlist,
          policy,
          tenant.name,
          showPitch,
          tenant.perPlayerSplitEnabled,
          tenant.dayStartHour,
        )}
        toCollectHasMore={ownerDay.isToday && ownerDay.toCollectHasMore}
        toCollectTotal={formatUsdCompact(earlierTotal)}
        free={
          <Suspense fallback={null}>
            <FreeStripSection membership={membership} locale={locale} date={date} />
          </Suspense>
        }
        games={toUpcomingViews(
          ownerDay.games,
          now,
          locale,
          hourCycle,
          openWaitlist,
          policy,
          tenant.name,
          showPitch,
          tenant.perPlayerSplitEnabled,
          tenant.dayStartHour,
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
      />
      </DayContent>
    </DayNavProvider>
  );
}

function DaySummaryLine({
  summary,
  locale,
}: {
  summary: DaySummary;
  locale: UiLocale;
}) {
  return (
    <p className="text-sm text-muted-foreground">
      <CountedPhrase text={uiCount("owner.games", summary.games, locale)} />
      {summary.noShows > 0 ? (
        <CountedPhrase
          text={uiCount("owner.noShows", summary.noShows, locale)}
          lead
        />
      ) : null}
      <MoneyPhrase
        amount={summary.collectedUsd}
        label={ui("owner.collectedWord", locale)}
      />
      <MoneyPhrase
        amount={summary.owedUsd}
        label={ui("owner.owedWord", locale)}
      />
      <MoneyPhrase
        amount={summary.expectedUsd}
        label={ui("owner.expectedWord", locale)}
      />
    </p>
  );
}

function CountedPhrase({ text, lead = false }: { text: string; lead?: boolean }) {
  const match = /^(\D*)(\d+)(\D*)$/.exec(text);
  return (
    <>
      {lead ? <span aria-hidden> · </span> : null}
      {match ? (
        <>
          {match[1]}
          <LtrIsolate>{match[2]}</LtrIsolate>
          {match[3]}
        </>
      ) : (
        text
      )}
    </>
  );
}

function MoneyPhrase({
  amount,
  label,
}: {
  amount: DaySummary["collectedUsd"];
  label: string;
}) {
  if (!amount.gt(0)) return null;
  return (
    <>
      <span aria-hidden> · </span>
      <LtrIsolate>${formatUsdCompact(amount)}</LtrIsolate>
      {" "}
      {label}
    </>
  );
}

function toUpcomingViews(
  rows: OwnerDayBooking[],
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
): UpcomingRowView[] {
  return rows.map((row) => {
    const display = deriveCardDisplay({
      start: row.start,
      end: row.end,
      price: row.amountDueUsd,
      remaining: row.remaining,
      now,
      status: row.status,
    });
    const booking = { amountDueUsd: row.amountDueUsd, start: row.start };
    const playerFee = suggestFee(policy, booking, now, "PLAYER");
    const ownerFee = suggestFee(policy, booking, now, "OWNER");
    const noShowFee = suggestFee(policy, booking, now, "NO_SHOW");
    const due = classifyDue({
      status: row.status,
      start: row.start,
      end: row.end,
      remaining: row.remaining,
      now,
    });
    const hoursBefore = Math.max(
      0,
      Math.floor((row.start.getTime() - now.getTime()) / 3_600_000),
    );
    return {
      id: row.id,
      pitchName: showPitch ? row.pitchName : null,
      timeRange: formatLocalClockRange(row.start, row.end, hourCycle, locale),
      dayLabel: formatEarlierDayLabel(row.start, now, locale, dayStartHour),
      dateLabel: formatSlotDateLabel(row.start, now, locale),
      nightHint: nightHint(row.start, locale, dayStartHour),
      requesterPersonId: row.requesterPersonId,
      requesterName: row.requesterName,
      requesterPhone: row.requesterPhone,
      remainingUsd: formatUsd(row.remaining),
      priceUsd: formatUsd(row.amountDueUsd),
      interested:
        row.status === "CANCELLED"
          ? peopleWaitingOn(openWaitlist, row, row.requesterPersonId)
          : [],
      status: upcomingStatus(row.start, row.remaining, now),
      display,
      displayAmountUsd:
        display.kind === "before"
          ? formatUsdCompact(row.priceUsd)
          : formatUsdCompact(row.remaining),
      confirmWhatsAppHref: row.confirmWhatsAppHref,
      showCancel:
        row.status === "APPROVED" &&
        !isCancelWindowClosed(row.start, now),
      showNoShow:
        row.status === "APPROVED" && isNoShowWindowEnded(row.end, now),
      perPlayer: {
        bookingId: row.id,
        mode: row.collectionMode,
        canSplit:
          splitEnabled &&
          row.status === "APPROVED" &&
          row.amountDueUsd.gt(0),
        defaultPlayerCount: row.pitchDefaultPlayerCount,
        slots: row.slots.map((slot) => {
          const state = slotPayState({
            amountDueUsd: row.amountDueUsd,
            collectedUsd: row.collectedUsd,
            slots: row.slots,
            participantId: slot.participantId,
          });
          return {
            participantId: slot.participantId,
            slotNumber: slot.slotNumber,
            name: slot.name,
            dueUsd: formatUsd(slot.dueUsd),
            remainingUsd: formatUsd(slot.remainingUsd),
            paid: state.kind === "paid",
            state: state.kind,
            chargeUsd: state.kind === "pay" ? formatUsd(state.chargeUsd) : null,
            partial: state.kind === "pay" && state.partial,
          };
        }),
        unassignedUsd: formatUsd(row.unassignedUsd),
        hasAllocations: row.slots.some((slot) => slot.paidUsd.gt(0)),
        // Same function the server charges with: never more than the booking owes.
        unpaidTotalUsd: formatUsd(
          planSlotCharge({
            amountDueUsd: row.amountDueUsd,
            collectedUsd: row.collectedUsd,
            slots: row.slots,
            target: "ALL_UNPAID",
          }).totalUsd,
        ),
      },
      canAdjust:
        row.collectionMode === "WHOLE" &&
        (due === "owed" || due === "expected"),
      hoursBefore,
      playerFeeCompact: feeCompact(playerFee.feeUsd, row.collectedUsd),
      playerFeeExact: formatUsd(playerFee.feeUsd),
      ownerFeeCompact: feeCompact(ownerFee.feeUsd, row.collectedUsd),
      ownerFeeExact: formatUsd(ownerFee.feeUsd),
      ownerCancelLowersFee: ownerInitiatorLowersFee({
        policy,
        booking,
        now,
        resultingFeeUsd: confirmedFee({
          suggestion: ownerFee,
          collectedUsd: row.collectedUsd,
        }).feeUsd,
      }),
      noShowFeeCompact: feeCompact(noShowFee.feeUsd, row.collectedUsd),
      noShowFeeExact: formatUsd(noShowFee.feeUsd),
      collectedExact: formatUsd(row.collectedUsd),
      collectedCompact: formatUsdCompact(row.collectedUsd),
      stadiumName,
      waDay: messageDayLabel(row.start, locale, dayStartHour),
      waTime: formatLocalHm(row.start, "Asia/Beirut", hourCycle, locale),
    };
  });
}

function feeCompact(fee: Decimal, collected: Decimal): string | null {
  if (fee.isZero() && collected.isZero()) return null;
  return formatUsdCompact(fee);
}
