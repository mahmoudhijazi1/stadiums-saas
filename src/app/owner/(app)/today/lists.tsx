import Link from "next/link";
import { Bell, ChevronRight } from "lucide-react";
import type { CurrentMembership } from "@/modules/access/application/get-current-membership";
import { BOOKINGS_CANCEL, BOOKINGS_NO_SHOW, PAYMENTS_COLLECT, can } from "@/modules/access/domain/can";
import { listDueBookings, type DueBooking } from "@/modules/booking/application/list-due-bookings";
import { listPendingRequests } from "@/modules/booking/application/list-pending-requests";
import { deriveCardDisplay } from "@/modules/booking/domain/card-display";
import { formatUsd } from "@/lib/money";
import type { UiLocale } from "@/lib/locale";
import { ui } from "@/lib/ui-copy";
import { formatSlotDateLabel } from "./date-label";
import { UpcomingPanel, type UpcomingRowView } from "./upcoming-panel";
import {
  formatLocalClock,
  formatLocalClockRange,
  type HourCycle,
} from "@/app/owner/shared";
import { getCurrentTenant } from "@/lib/tenant-context";
import {
  upcomingStatus,
} from "@/modules/booking/domain/home-inbox";
import { isPastUnpaidCancel, isNoShowWindowEnded } from "@/modules/booking/domain/decision";
import { LtrIsolate } from "@/components/ui/ltr-isolate";

export async function OwnerToday({
  membership,
  locale = "ar",
  highlight,
}: {
  membership: CurrentMembership;
  locale?: UiLocale;
  highlight?: string;
}) {
  const tenant = await getCurrentTenant();
  const hourCycle: HourCycle = tenant.timeDisplay;
  const pending = await listPendingRequests();
  const confirmed = await listDueBookings();
  const now = new Date();
  const mayCollect = can(membership, PAYMENTS_COLLECT);
  const mayCancel = can(membership, BOOKINGS_CANCEL);
  const mayNoShow = can(membership, BOOKINGS_NO_SHOW);
  const earliest = pending[0];

  return (
    <>
      {pending.length > 0 && earliest ? (
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
        overdue={toUpcomingViews(confirmed.overdue, now, locale, hourCycle)}
        today={toUpcomingViews(confirmed.today, now, locale, hourCycle)}
        later={toUpcomingViews(confirmed.later, now, locale, hourCycle)}
        locale={locale}
        mayCollect={mayCollect}
        mayCancel={mayCancel}
        mayNoShow={mayNoShow}
        highlight={highlight}
      />
    </>
  );
}

function toUpcomingViews(
  rows: DueBooking[],
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
      display.kind === "before" ? formatUsd(row.priceUsd) : formatUsd(row.remaining),
    confirmWhatsAppHref: row.confirmWhatsAppHref,
    showCancel:
      row.status === "APPROVED" &&
      !isPastUnpaidCancel(row.start, row.remaining, now),
    showNoShow:
      row.status === "APPROVED" && isNoShowWindowEnded(row.end, now),
    };
  });
}
