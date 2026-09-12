import type { CurrentMembership } from "@/modules/access/application/get-current-membership";
import { BOOKINGS_APPROVE, BOOKINGS_CANCEL, PAYMENTS_COLLECT, can } from "@/modules/access/domain/can";
import { listDueBookings, type DueBooking } from "@/modules/booking/application/list-due-bookings";
import { listPendingRequests } from "@/modules/booking/application/list-pending-requests";
import { formatUsd } from "@/lib/money";
import type { UiLocale } from "@/lib/locale";
import { requestsCount, ui } from "@/lib/ui-copy";
import {
  submitApproveBooking,
  submitRejectBooking,
} from "./actions";
import { formatSlotDateLabel } from "./date-label";
import { UpcomingPanel, type UpcomingRowView } from "./upcoming-panel";
import { formatLocalClockRange } from "@/app/owner/shared";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { SubmitButton } from "@/components/ui/submit-button";
import { LtrIsolate } from "@/components/ui/ltr-isolate";
import {
  groupPendingBySlot,
  upcomingStatus,
} from "@/modules/booking/domain/home-inbox";

function keepTenantQuery(tenantSlug: string) {
  return <input type="hidden" name="tenant" value={tenantSlug} />;
}

export async function OwnerToday({
  membership,
  tenantSlug,
  locale = "ar",
}: {
  membership: CurrentMembership;
  tenantSlug: string;
  locale?: UiLocale;
}) {
  const pending = await listPendingRequests();
  const confirmed = await listDueBookings();
  const groups = groupPendingBySlot(pending);
  const now = new Date();
  const mayDecide = can(membership, BOOKINGS_APPROVE);
  const mayCollect = can(membership, PAYMENTS_COLLECT);
  const mayCancel = can(membership, BOOKINGS_CANCEL);

  return (
    <>
      <h3 className="text-sm font-medium text-muted-foreground">
        {requestsCount(pending.length, locale)}
      </h3>
      {pending.length === 0 ? (
        <EmptyState
          title={ui("empty.pending", locale)}
          next={ui("empty.pendingNext", locale)}
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {groups.map((group) => (
            <li
              key={`${group.pitchId}-${group.start.toISOString()}-${group.end.toISOString()}`}
            >
              <Card className="gap-3 py-4">
                <CardHeader className="gap-1">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <span className="text-sm text-muted-foreground">
                      {formatSlotDateLabel(group.start, now, locale)}
                    </span>
                    <LtrIsolate className="text-sm font-medium">
                      {formatLocalClockRange(group.start, group.end)}
                    </LtrIsolate>
                    <CardTitle className="text-base">{group.pitchName}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  {group.requesters.map((row) => (
                    <div
                      key={row.id}
                      className="flex flex-col gap-3 border-t pt-3 first:border-t-0 first:pt-0"
                    >
                      <CardDescription className="flex flex-wrap items-center gap-2">
                        <span>{row.requesterName}</span>
                        {group.requesters.length > 1 ? (
                          <Badge variant="outline">
                            {ui("owner.pending", locale)}
                          </Badge>
                        ) : null}
                      </CardDescription>
                      {mayDecide ? (
                        <div className="flex gap-2">
                          <form action={submitApproveBooking} className="min-w-0 flex-1">
                            <input type="hidden" name="bookingId" value={row.id} />
                            {keepTenantQuery(tenantSlug)}
                            <SubmitButton className="w-full">
                              {ui("owner.approve", locale)}
                            </SubmitButton>
                          </form>
                          <form action={submitRejectBooking} className="min-w-0 flex-1">
                            <input type="hidden" name="bookingId" value={row.id} />
                            {keepTenantQuery(tenantSlug)}
                            <SubmitButton variant="outline" className="w-full">
                              {ui("owner.reject", locale)}
                            </SubmitButton>
                          </form>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <UpcomingPanel
        overdue={toUpcomingViews(confirmed.overdue, now, locale)}
        today={toUpcomingViews(confirmed.today, now, locale)}
        later={toUpcomingViews(confirmed.later, now, locale)}
        tenantSlug={tenantSlug}
        locale={locale}
        mayCollect={mayCollect}
        mayCancel={mayCancel}
      />
    </>
  );
}

function toUpcomingViews(
  rows: DueBooking[],
  now: Date,
  locale: UiLocale,
): UpcomingRowView[] {
  return rows.map((row) => ({
    id: row.id,
    pitchName: row.pitchName,
    timeRange: formatLocalClockRange(row.start, row.end),
    dateLabel: formatSlotDateLabel(row.start, now, locale),
    requesterName: row.requesterName,
    requesterPhone: row.requesterPhone,
    remainingUsd: formatUsd(row.remaining),
    priceUsd: formatUsd(row.priceUsd),
    status: upcomingStatus(row.start, row.remaining, now),
  }));
}
