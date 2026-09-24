import Link from "next/link";
import { Bell, ChevronRight } from "lucide-react";
import type { CurrentMembership } from "@/modules/access/application/get-current-membership";
import { BOOKINGS_CANCEL, BOOKINGS_NO_SHOW, PAYMENTS_COLLECT, can } from "@/modules/access/domain/can";
import {
  loadOwnerDay,
  type OwnerDayBooking,
} from "@/modules/booking/application/load-owner-day";
import { listPendingRequests } from "@/modules/booking/application/list-pending-requests";
import { deriveCardDisplay } from "@/modules/booking/domain/card-display";
import type { DaySummary } from "@/modules/booking/domain/day-summary";
import { formatUsd, formatUsdCompact } from "@/lib/money";
import type { UiLocale } from "@/lib/locale";
import { ui, uiCount } from "@/lib/ui-copy";
import { formatSlotDateLabel } from "./date-label";
import { OwnerDayStrip } from "./day-strip";
import { UpcomingPanel, type UpcomingRowView } from "./upcoming-panel";
import {
  formatLocalClock,
  formatLocalClockRange,
  type HourCycle,
} from "@/app/owner/shared";
import { getCurrentTenant } from "@/lib/tenant-context";
import { upcomingStatus } from "@/modules/booking/domain/home-inbox";
import { isPastUnpaidCancel, isNoShowWindowEnded } from "@/modules/booking/domain/decision";
import { LtrIsolate } from "@/components/ui/ltr-isolate";

export async function OwnerToday({
  membership,
  locale = "ar",
  highlight,
  date,
}: {
  membership: CurrentMembership;
  locale?: UiLocale;
  highlight?: string;
  date?: string;
}) {
  const tenant = await getCurrentTenant();
  const hourCycle: HourCycle = tenant.timeDisplay;
  const ownerDay = await loadOwnerDay(date);
  const pending = ownerDay.isToday ? await listPendingRequests() : [];
  const now = new Date();
  const mayCollect = can(membership, PAYMENTS_COLLECT);
  const mayCancel = can(membership, BOOKINGS_CANCEL);
  const mayNoShow = can(membership, BOOKINGS_NO_SHOW);
  const earliest = pending[0];
  const { summary } = ownerDay;

  return (
    <>
      <OwnerDayStrip day={ownerDay.day} today={ownerDay.today} locale={locale} />
      <DaySummaryLine summary={summary} locale={locale} />

      {ownerDay.isToday && pending.length > 0 && earliest ? (
        <Link
          href="/owner/requests"
          className="flex min-h-14 w-full items-center gap-3 rounded-xl border bg-card px-4 py-3 text-sm font-medium outline-none hover:bg-muted/60 focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <Bell aria-hidden className="size-5 shrink-0" />
          <span className="min-w-0 flex-1">
            <LtrIsolate>{pending.length}</LtrIsolate>
            {" "}
            {ui("owner.newRequests", locale)}
            <span aria-hidden> · </span>
            <LtrIsolate>
              {formatLocalClock(earliest.start, hourCycle)}
            </LtrIsolate>
          </span>
          <ChevronRight
            aria-hidden
            className="size-5 shrink-0 text-muted-foreground rtl:rotate-180"
          />
        </Link>
      ) : null}

      <UpcomingPanel
        toCollect={
          ownerDay.isToday
            ? toUpcomingViews(ownerDay.toCollect, now, locale, hourCycle)
            : []
        }
        toCollectHasMore={ownerDay.isToday && ownerDay.toCollectHasMore}
        games={toUpcomingViews(ownerDay.games, now, locale, hourCycle)}
        locale={locale}
        mayCollect={mayCollect}
        mayCancel={mayCancel}
        mayNoShow={mayNoShow}
        highlight={highlight}
      />
    </>
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
): UpcomingRowView[] {
  return rows.map((row) => {
    const display = deriveCardDisplay({
      start: row.start,
      end: row.end,
      price: row.priceUsd,
      remaining: row.remaining,
      now,
      status: row.status,
    });
    return {
      id: row.id,
      pitchName: row.pitchName,
      timeRange: formatLocalClockRange(row.start, row.end, hourCycle),
      dateLabel: formatSlotDateLabel(row.start, now, locale),
      requesterName: row.requesterName,
      requesterPhone: row.requesterPhone,
      remainingUsd: formatUsd(row.remaining),
      priceUsd: formatUsd(row.priceUsd),
      status: upcomingStatus(row.start, row.remaining, now),
      display,
      displayAmountUsd:
        display.kind === "before"
          ? formatUsdCompact(row.priceUsd)
          : formatUsdCompact(row.remaining),
      confirmWhatsAppHref: row.confirmWhatsAppHref,
      showCancel:
        row.status === "APPROVED" &&
        !isPastUnpaidCancel(row.start, row.remaining, now),
      showNoShow:
        row.status === "APPROVED" && isNoShowWindowEnded(row.end, now),
    };
  });
}
