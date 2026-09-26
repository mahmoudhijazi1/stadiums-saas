import type { CurrentMembership } from "@/modules/access/application/get-current-membership";
import { BOOKINGS_APPROVE, can } from "@/modules/access/domain/can";
import type { WaitlistGroup } from "@/modules/booking/application/list-open-waitlist";
import type { listPendingRequests } from "@/modules/booking/application/list-pending-requests";
import { groupPendingBySlot } from "@/modules/booking/domain/home-inbox";
import type { UiLocale } from "@/lib/locale";
import { missedRequestsCount, requestsCount, startsInLabel, ui } from "@/lib/ui-copy";
import { startsInMinutes } from "@/modules/booking/domain/expired-request";
import { formatRelativeTime } from "@/lib/format-relative-time";
import { formatDisplayDate } from "@/lib/format-display-date";
import {
  interestsForGroup,
  mergeByTime,
} from "@/app/owner/(app)/requests/merge-slots";
import {
  CountedPhrase,
  DebtNoticeLine,
  NotifyPersonRow,
  RelativeWhen,
  type DebtNotice,
} from "@/app/owner/notify-list";
import {
  formatLocalClockRange,
  type HourCycle,
} from "@/app/owner/shared";
import { formatSlotDateLabel } from "@/app/owner/(app)/today/date-label";
import {
  submitApproveBooking,
  submitDismissBooking,
  submitDismissMissed,
} from "@/app/owner/(app)/today/actions";
import { RejectRequestButton } from "@/app/owner/(app)/requests/reject-sheet";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { SubmitButton } from "@/components/ui/submit-button";
import { ClockRangeText, LtrIsolate } from "@/components/ui/ltr-isolate";
import Link from "next/link";
import { Clock, MapPin, Phone } from "lucide-react";

type PendingRequest = Awaited<ReturnType<typeof listPendingRequests>>[number];

/**
 * Pending inbox on Requests. Approve and Reject stay available.
 * Debt is a warning on the row, loaded once for everyone on the screen.
 */
export function PendingRequestList({
  membership,
  locale,
  hourCycle,
  pending,
  openWaitlist,
  debts,
  showEmpty = true,
}: {
  membership: CurrentMembership;
  locale: UiLocale;
  hourCycle: HourCycle;
  pending: PendingRequest[];
  openWaitlist: WaitlistGroup[];
  debts: Record<string, DebtNotice>;
  /** False when missed requests sit below, so an empty queue is not "no requests". */
  showEmpty?: boolean;
}) {
  const groups = groupPendingBySlot(pending);
  const now = new Date();
  const mayDecide = can(membership, BOOKINGS_APPROVE);
  if (pending.length === 0 && !showEmpty) return null;

  return (
    <>
      <h3 className="text-sm font-medium text-muted-foreground">
        <CountedPhrase text={requestsCount(pending.length, locale)} />
      </h3>
      {pending.length === 0 ? (
        <EmptyState
          title={ui("empty.pending", locale)}
          next={ui("empty.pendingNext", locale)}
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {groups.map((group) => {
            const soon = startsInMinutes(group.start, now);
            return (
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
                    <ClockRangeText
                      text={formatLocalClockRange(
                        group.start,
                        group.end,
                        hourCycle,
                        locale,
                      )}
                      className="text-lg font-semibold leading-none"
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin aria-hidden className="size-4 shrink-0" />
                      {group.pitchName}
                    </span>
                    <span>{formatSlotDateLabel(group.start, now, locale)}</span>
                  </div>
                  {soon === null ? null : (
                    <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                      <CountedPhrase text={startsInLabel(soon, locale)} />
                    </p>
                  )}
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  {mergeByTime(
                    group.requesters,
                    interestsForGroup(group, openWaitlist),
                  ).map((item) =>
                    item.kind === "request" ? (
                      <div
                        key={item.request.id}
                        className="flex flex-col gap-3 border-t pt-3 first:border-t-0 first:pt-0"
                      >
                        <div className="flex flex-col gap-1">
                          <Link
                            href={`/owner/people/${item.request.requesterPersonId}`}
                            className="text-sm font-medium underline-offset-2 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
                          >
                            {item.request.requesterName}
                          </Link>
                          <p className="text-sm text-muted-foreground">
                            <RelativeWhen
                              text={formatRelativeTime(
                                item.request.requestedAt,
                                now,
                                {
                                  locale,
                                  timeZone: "Asia/Beirut",
                                  timeDisplay: hourCycle,
                                },
                              )}
                            />
                          </p>
                          {item.request.requesterPhone ? (
                            <p className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                              <Phone aria-hidden className="size-4 shrink-0" />
                              <LtrIsolate>{item.request.requesterPhone}</LtrIsolate>
                            </p>
                          ) : null}
                          {debts[item.request.requesterPersonId] ? (
                            <DebtNoticeLine
                              notice={debts[item.request.requesterPersonId]}
                              personId={item.request.requesterPersonId}
                              locale={locale}
                            />
                          ) : null}
                        </div>
                        {mayDecide ? (
                          <div className="flex gap-2">
                            <form action={submitApproveBooking} className="min-w-0 flex-1">
                              <input type="hidden" name="bookingId" value={item.request.id} />
                              <SubmitButton className="w-full">
                                {ui("owner.approve", locale)}
                              </SubmitButton>
                            </form>
                            <RejectRequestButton
                              bookingId={item.request.id}
                              name={item.request.requesterName}
                              locale={locale}
                            />
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <div
                        key={`interest-${item.interest.personId}`}
                        className="border-t pt-3 first:border-t-0 first:pt-0"
                      >
                        <NotifyPersonRow
                          person={{
                            ...item.interest,
                            debt: debts[item.interest.personId] ?? null,
                          }}
                          locale={locale}
                          href={`/owner/people/${item.interest.personId}`}
                          detail={
                            <>
                              {ui("owner.waitingSince", locale)}{" "}
                              <LtrIsolate>
                                {formatDisplayDate(item.interest.createdAt, locale, {
                                  day: "numeric",
                                  month: "long",
                                })}
                              </LtrIsolate>
                            </>
                          }
                        />
                      </div>
                    ),
                  )}
                </CardContent>
              </Card>
            </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

/**
 * Collapsed missed requests. No Approve or Reject.
 * "They played" is the only approve path for a started slot.
 */
export function MissedRequestSection({
  membership,
  locale,
  hourCycle,
  missed,
}: {
  membership: CurrentMembership;
  locale: UiLocale;
  hourCycle: HourCycle;
  missed: PendingRequest[];
}) {
  if (missed.length === 0) return null;
  const groups = groupPendingBySlot(missed);
  const now = new Date();
  const mayDecide = can(membership, BOOKINGS_APPROVE);

  return (
    <details className="rounded-xl border">
      <summary className="cursor-pointer px-4 py-3 text-sm font-medium">
        <CountedPhrase text={missedRequestsCount(missed.length, locale)} />
      </summary>
      <div className="flex flex-col gap-3 px-4 pb-4">
        {mayDecide ? (
          <form action={submitDismissMissed}>
            <SubmitButton variant="secondary" size="sm">
              {ui("owner.dismissAll", locale)}
            </SubmitButton>
          </form>
        ) : null}
        <ul className="flex flex-col gap-3">
          {groups.map((group) => (
            <li
              key={`${group.pitchId}-${group.start.toISOString()}-${group.end.toISOString()}`}
            >
              <Card className="gap-3 py-4">
                <CardHeader className="gap-2">
                  <ClockRangeText
                    text={formatLocalClockRange(
                      group.start,
                      group.end,
                      hourCycle,
                      locale,
                    )}
                    className="text-lg font-semibold leading-none"
                  />
                  <p className="text-sm text-muted-foreground">
                    {group.pitchName}
                    <span aria-hidden> · </span>
                    {formatSlotDateLabel(group.start, now, locale)}
                  </p>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  {group.requesters.map((request) => (
                    <div
                      key={request.id}
                      className="flex flex-col gap-3 border-t pt-3 first:border-t-0 first:pt-0"
                    >
                      <div className="flex flex-col gap-1">
                        <Link
                          href={`/owner/people/${request.requesterPersonId}`}
                          className="text-sm font-medium underline-offset-2 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
                        >
                          {request.requesterName}
                        </Link>
                        <p className="text-sm text-muted-foreground">
                          <RelativeWhen
                            text={formatRelativeTime(request.requestedAt, now, {
                              locale,
                              timeZone: "Asia/Beirut",
                              timeDisplay: hourCycle,
                            })}
                          />
                        </p>
                      </div>
                      {mayDecide ? (
                        <div className="flex gap-2">
                          <form action={submitApproveBooking} className="min-w-0 flex-1">
                            <input type="hidden" name="bookingId" value={request.id} />
                            <input type="hidden" name="allowStarted" value="1" />
                            <SubmitButton className="w-full" variant="secondary">
                              {ui("owner.theyPlayed", locale)}
                            </SubmitButton>
                          </form>
                          <form action={submitDismissBooking}>
                            <input type="hidden" name="bookingId" value={request.id} />
                            <SubmitButton variant="ghost">
                              {ui("owner.dismiss", locale)}
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
      </div>
    </details>
  );
}
