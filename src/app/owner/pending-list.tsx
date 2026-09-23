import type { CurrentMembership } from "@/modules/access/application/get-current-membership";
import { BOOKINGS_APPROVE, can } from "@/modules/access/domain/can";
import { listPendingRequests } from "@/modules/booking/application/list-pending-requests";
import { groupPendingBySlot } from "@/modules/booking/domain/home-inbox";
import type { UiLocale } from "@/lib/locale";
import { requestsCount, ui } from "@/lib/ui-copy";
import { getCurrentTenant } from "@/lib/tenant-context";
import {
  formatLocalClockRange,
  type HourCycle,
} from "@/app/owner/shared";
import { formatSlotDateLabel } from "@/app/owner/today/date-label";
import {
  submitApproveBooking,
  submitRejectBooking,
} from "@/app/owner/today/actions";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { SubmitButton } from "@/components/ui/submit-button";
import { LtrIsolate } from "@/components/ui/ltr-isolate";
import { Clock, MapPin, Phone } from "lucide-react";

/**
 * Pending inbox shared by Today and /owner/requests until the Requests slice
 * owns notify and reject reasons. Approve still returns to Today.
 */
export async function PendingRequestList({
  membership,
  locale,
}: {
  membership: CurrentMembership;
  locale: UiLocale;
}) {
  const tenant = await getCurrentTenant();
  const hourCycle: HourCycle = tenant.timeDisplay;
  const pending = await listPendingRequests();
  const groups = groupPendingBySlot(pending);
  const now = new Date();
  const mayDecide = can(membership, BOOKINGS_APPROVE);

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
                <CardHeader className="gap-2">
                  <div className="flex items-center gap-2">
                    <Clock
                      aria-hidden
                      className="size-4 shrink-0 text-muted-foreground"
                    />
                    <LtrIsolate className="text-lg font-semibold leading-none">
                      {formatLocalClockRange(
                        group.start,
                        group.end,
                        hourCycle,
                      )}
                    </LtrIsolate>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin aria-hidden className="size-4 shrink-0" />
                      {group.pitchName}
                    </span>
                    <span>{formatSlotDateLabel(group.start, now, locale)}</span>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  {group.requesters.map((row) => (
                    <div
                      key={row.id}
                      className="flex flex-col gap-3 border-t pt-3 first:border-t-0 first:pt-0"
                    >
                      <div className="flex flex-col gap-1">
                        <p className="text-sm font-medium">{row.requesterName}</p>
                        <p className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                          <Phone aria-hidden className="size-4 shrink-0" />
                          <LtrIsolate>{row.requesterPhone}</LtrIsolate>
                        </p>
                      </div>
                      {mayDecide ? (
                        <div className="flex gap-2">
                          <form action={submitApproveBooking} className="min-w-0 flex-1">
                            <input type="hidden" name="bookingId" value={row.id} />
                            <SubmitButton className="w-full">
                              {ui("owner.approve", locale)}
                            </SubmitButton>
                          </form>
                          <form action={submitRejectBooking} className="min-w-0 flex-1">
                            <input type="hidden" name="bookingId" value={row.id} />
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
    </>
  );
}
