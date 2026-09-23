import type { CurrentMembership } from "@/modules/access/application/get-current-membership";
import { BOOKINGS_CANCEL, BOOKINGS_NO_SHOW, PAYMENTS_COLLECT, can } from "@/modules/access/domain/can";
import { listDueBookings, type DueBooking } from "@/modules/booking/application/list-due-bookings";
import { formatUsd } from "@/lib/money";
import type { UiLocale } from "@/lib/locale";
import { formatSlotDateLabel } from "./date-label";
import { PendingRequestList } from "@/app/owner/pending-list";
import { UpcomingPanel, type UpcomingRowView } from "./upcoming-panel";
import {
  formatLocalClockRange,
  type HourCycle,
} from "@/app/owner/shared";
import { getCurrentTenant } from "@/lib/tenant-context";
import {
  upcomingStatus,
} from "@/modules/booking/domain/home-inbox";
import { isPastUnpaidCancel, isNoShowWindowEnded } from "@/modules/booking/domain/decision";

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
  const confirmed = await listDueBookings();
  const now = new Date();
  const mayCollect = can(membership, PAYMENTS_COLLECT);
  const mayCancel = can(membership, BOOKINGS_CANCEL);
  const mayNoShow = can(membership, BOOKINGS_NO_SHOW);

  return (
    <>
      <PendingRequestList membership={membership} locale={locale} />

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
  return rows.map((row) => ({
    id: row.id,
    pitchName: row.pitchName,
    timeRange: formatLocalClockRange(row.start, row.end, hourCycle),
    dateLabel: formatSlotDateLabel(row.start, now, locale),
    requesterName: row.requesterName,
    requesterPhone: row.requesterPhone,
    remainingUsd: formatUsd(row.remaining),
    priceUsd: formatUsd(row.priceUsd),
    status: upcomingStatus(row.start, row.remaining, now),
    confirmWhatsAppHref: row.confirmWhatsAppHref,
    showCancel:
      row.status === "APPROVED" &&
      !isPastUnpaidCancel(row.start, row.remaining, now),
    showNoShow:
      row.status === "APPROVED" && isNoShowWindowEnded(row.end, now),
  }));
}
