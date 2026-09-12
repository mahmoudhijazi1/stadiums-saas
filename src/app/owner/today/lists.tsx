import type { CurrentMembership } from "@/modules/access/application/get-current-membership";
import { BOOKINGS_APPROVE, BOOKINGS_CANCEL, PAYMENTS_COLLECT, can } from "@/modules/access/domain/can";
import { listDueBookings } from "@/modules/booking/application/list-due-bookings";
import { listPendingRequests } from "@/modules/booking/application/list-pending-requests";
import { formatUsd } from "@/lib/money";
import type { UiLocale } from "@/lib/locale";
import {
  collectUsdLabel,
  confirmedCount,
  dueRemainingLine,
  pendingCount,
  ui,
} from "@/lib/ui-copy";
import {
  submitApproveBooking,
  submitCancelBooking,
  submitCollectPayment,
  submitRejectBooking,
} from "./actions";
import { formatLocalRange, OWNER_TIME_ZONE } from "@/app/owner/shared";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/ui/submit-button";
import { LtrIsolate } from "@/components/ui/ltr-isolate";

function keepTenantQuery(tenantSlug: string) {
  return <input type="hidden" name="tenant" value={tenantSlug} />;
}

function formatLocalDateTime(value: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: OWNER_TIME_ZONE,
    dateStyle: "medium",
    timeStyle: "short",
    hour12: false,
  }).format(value);
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
  const mayDecide = can(membership, BOOKINGS_APPROVE);
  const mayCollect = can(membership, PAYMENTS_COLLECT);
  const mayCancel = can(membership, BOOKINGS_CANCEL);

  return (
    <>
      <h3 className="text-sm font-medium text-muted-foreground">
        {pendingCount(pending.length, locale)}
      </h3>
      {pending.length === 0 ? (
        <EmptyState
          title={ui("empty.pending", locale)}
          next={ui("empty.pendingNext", locale)}
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {pending.map((row) => (
            <li key={row.id}>
              <Card>
                <CardHeader className="gap-1">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-base">{row.pitchName}</CardTitle>
                    <Badge variant="outline">{ui("owner.pending", locale)}</Badge>
                  </div>
                  <CardDescription>
                    <LtrIsolate className="block">
                      {formatLocalRange(row.start, row.end)}
                    </LtrIsolate>
                    <span className="mt-1 block">
                      {row.requesterName}{" "}
                      <LtrIsolate>{row.requesterPhone}</LtrIsolate>
                    </span>
                    <span className="mt-1 block">
                      {ui("owner.requested", locale)}{" "}
                      <LtrIsolate>{formatLocalDateTime(row.requestedAt)}</LtrIsolate>
                    </span>
                  </CardDescription>
                </CardHeader>
                {mayDecide ? (
                  <CardContent className="flex gap-2">
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
                  </CardContent>
                ) : null}
              </Card>
            </li>
          ))}
        </ul>
      )}

      <h3 className="text-sm font-medium text-muted-foreground">
        {confirmedCount(confirmed.length, locale)}
      </h3>
      {confirmed.length === 0 ? (
        <EmptyState
          title={ui("empty.confirmed", locale)}
          next={ui("empty.confirmedNext", locale)}
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {confirmed.map((row) => (
            <li key={row.id}>
              <Card>
                <CardHeader className="gap-1">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-base">{row.pitchName}</CardTitle>
                    <Badge variant={row.remaining.gt(0) ? "outline" : "default"}>
                      {row.remaining.gt(0)
                        ? ui("owner.due", locale)
                        : ui("owner.paid", locale)}
                    </Badge>
                  </div>
                  <CardDescription>
                    <LtrIsolate className="block">
                      {formatLocalRange(row.start, row.end)}
                    </LtrIsolate>
                    <span className="mt-1 block">
                      {row.requesterName}{" "}
                      <LtrIsolate>{row.requesterPhone}</LtrIsolate>
                    </span>
                    <span className="mt-1 block">
                      {dueRemainingLine(
                        formatUsd(row.priceUsd),
                        formatUsd(row.remaining),
                        locale,
                      )}
                    </span>
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  {mayCollect && row.remaining.gt(0) ? (
                    <>
                      <form action={submitCollectPayment}>
                        <input type="hidden" name="bookingId" value={row.id} />
                        {keepTenantQuery(tenantSlug)}
                        <input
                          type="hidden"
                          name="usdAmount"
                          value={formatUsd(row.remaining)}
                        />
                        <SubmitButton className="w-full">
                          {collectUsdLabel(formatUsd(row.remaining), locale)}
                        </SubmitButton>
                      </form>
                      <form
                        action={submitCollectPayment}
                        className="flex flex-col gap-4"
                      >
                        <input type="hidden" name="bookingId" value={row.id} />
                        {keepTenantQuery(tenantSlug)}
                        <div className="flex flex-col gap-2">
                          <Label htmlFor={`usd-${row.id}`}>
                            {ui("owner.usd", locale)}
                          </Label>
                          <Input
                            id={`usd-${row.id}`}
                            type="text"
                            name="usdAmount"
                            inputMode="decimal"
                            placeholder="30.00"
                            className="font-mono"
                          />
                        </div>
                        <div className="flex flex-col gap-2">
                          <Label htmlFor={`lbp-${row.id}`}>
                            {ui("owner.lbp", locale)}
                          </Label>
                          <Input
                            id={`lbp-${row.id}`}
                            type="text"
                            name="lbpAmount"
                            inputMode="numeric"
                            className="font-mono"
                          />
                        </div>
                        <SubmitButton variant="secondary" className="w-full">
                          {ui("owner.collectMixed", locale)}
                        </SubmitButton>
                      </form>
                    </>
                  ) : null}
                  {mayCancel ? (
                    <form action={submitCancelBooking}>
                      <input type="hidden" name="bookingId" value={row.id} />
                      {keepTenantQuery(tenantSlug)}
                      <SubmitButton variant="outline" className="w-full">
                        {ui("owner.cancel", locale)}
                      </SubmitButton>
                    </form>
                  ) : null}
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
