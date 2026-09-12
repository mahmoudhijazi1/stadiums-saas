import type { CurrentMembership } from "@/modules/access/application/get-current-membership";
import { BOOKINGS_APPROVE, BOOKINGS_CANCEL, PAYMENTS_COLLECT, can } from "@/modules/access/domain/can";
import { listDueBookings } from "@/modules/booking/application/list-due-bookings";
import { listPendingRequests } from "@/modules/booking/application/list-pending-requests";
import type { LedgerPeriodQuery } from "@/modules/ledger/schemas/period-query";
import { formatUsd } from "@/lib/money";
import { confirmedCount, pendingCount, ui } from "@/lib/ui-copy";
import {
  submitApproveBooking,
  submitCancelBooking,
  submitCollectPayment,
  submitRejectBooking,
} from "@/app/owner/actions";
import {
  formatLocalDateTime,
  formatLocalRange,
  keepOwnerQuery,
} from "@/app/owner/shared";
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

export async function OwnerToday({
  membership,
  tenantSlug,
  bookOn,
  periodQuery,
}: {
  membership: CurrentMembership;
  tenantSlug: string;
  bookOn: string;
  periodQuery: LedgerPeriodQuery;
}) {
  const pending = await listPendingRequests();
  const confirmed = await listDueBookings();
  const mayDecide = can(membership, BOOKINGS_APPROVE);
  const mayCollect = can(membership, PAYMENTS_COLLECT);
  const mayCancel = can(membership, BOOKINGS_CANCEL);

  return (
    <>
      <h3 className="text-sm font-medium text-muted-foreground">
        {pendingCount(pending.length)}
      </h3>
      {pending.length === 0 ? (
        <EmptyState
          title={ui("empty.pending")}
          next={ui("empty.pendingNext")}
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {pending.map((row) => (
            <li key={row.id}>
              <Card>
                <CardHeader className="gap-1">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-base">{row.pitchName}</CardTitle>
                    <Badge variant="outline">{ui("owner.pending")}</Badge>
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
                      {ui("owner.requested")}{" "}
                      <LtrIsolate>{formatLocalDateTime(row.requestedAt)}</LtrIsolate>
                    </span>
                  </CardDescription>
                </CardHeader>
                {mayDecide ? (
                  <CardContent className="flex gap-2">
                    <form action={submitApproveBooking} className="min-w-0 flex-1">
                      <input type="hidden" name="bookingId" value={row.id} />
                      {keepOwnerQuery(tenantSlug, bookOn, periodQuery)}
                      <SubmitButton className="w-full">{ui("owner.approve")}</SubmitButton>
                    </form>
                    <form action={submitRejectBooking} className="min-w-0 flex-1">
                      <input type="hidden" name="bookingId" value={row.id} />
                      {keepOwnerQuery(tenantSlug, bookOn, periodQuery)}
                      <SubmitButton variant="outline" className="w-full">
                        {ui("owner.reject")}
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
        {confirmedCount(confirmed.length)}
      </h3>
      {confirmed.length === 0 ? (
        <EmptyState
          title={ui("empty.confirmed")}
          next={ui("empty.confirmedNext")}
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
                      {row.remaining.gt(0) ? ui("owner.due") : ui("owner.paid")}
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
                      المستحق{" "}
                      <LtrIsolate>${formatUsd(row.priceUsd)}</LtrIsolate>
                      {" · "}
                      المتبقي{" "}
                      <LtrIsolate>${formatUsd(row.remaining)}</LtrIsolate>
                    </span>
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  {mayCollect && row.remaining.gt(0) ? (
                    <>
                      <form action={submitCollectPayment}>
                        <input type="hidden" name="bookingId" value={row.id} />
                        {keepOwnerQuery(tenantSlug, bookOn, periodQuery)}
                        <input
                          type="hidden"
                          name="usdAmount"
                          value={formatUsd(row.remaining)}
                        />
                        <SubmitButton className="w-full">
                          تحصيل{" "}
                          <LtrIsolate>
                            ${formatUsd(row.remaining)}
                          </LtrIsolate>
                        </SubmitButton>
                      </form>
                      <form
                        action={submitCollectPayment}
                        className="flex flex-col gap-4"
                      >
                        <input type="hidden" name="bookingId" value={row.id} />
                        {keepOwnerQuery(tenantSlug, bookOn, periodQuery)}
                        <div className="flex flex-col gap-2">
                          <Label htmlFor={`usd-${row.id}`}>{ui("owner.usd")}</Label>
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
                          <Label htmlFor={`lbp-${row.id}`}>{ui("owner.lbp")}</Label>
                          <Input
                            id={`lbp-${row.id}`}
                            type="text"
                            name="lbpAmount"
                            inputMode="numeric"
                            className="font-mono"
                          />
                        </div>
                        <SubmitButton variant="secondary" className="w-full">
                          {ui("owner.collectMixed")}
                        </SubmitButton>
                      </form>
                    </>
                  ) : null}
                  {mayCancel ? (
                    <form action={submitCancelBooking}>
                      <input type="hidden" name="bookingId" value={row.id} />
                      {keepOwnerQuery(tenantSlug, bookOn, periodQuery)}
                      <SubmitButton variant="outline" className="w-full">
                        {ui("owner.cancel")}
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
