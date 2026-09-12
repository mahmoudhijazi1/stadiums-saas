import { listApprovedOccupied } from "@/modules/booking/application/list-approved-occupied";
import type { LedgerPeriodQuery } from "@/modules/ledger/schemas/period-query";
import { getDayAvailability } from "@/modules/venue/application/get-day-availability";
import { submitCreateOwnerBooking } from "@/app/owner/actions";
import {
  OWNER_TIME_ZONE,
  civilFromYyyyMmDd,
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
import { hoursEmptyState, ui } from "@/lib/ui-copy";

export async function OwnerBookSlots({
  tenantSlug,
  bookOn,
  periodQuery,
}: {
  tenantSlug: string;
  bookOn: string;
  periodQuery: LedgerPeriodQuery;
}) {
  const bookPitches = await getDayAvailability({
    localDate: civilFromYyyyMmDd(bookOn),
    timeZone: OWNER_TIME_ZONE,
    now: new Date(),
    occupied: await listApprovedOccupied(),
  });

  if (bookPitches.length === 0) {
    return (
      <EmptyState
        title={ui("empty.pitches")}
        next={ui("empty.pitchesNext")}
      />
    );
  }

  return (
    <ul className="flex flex-col gap-4">
      {bookPitches.map((pitch) => (
        <li key={pitch.id} className="flex flex-col gap-3">
          <h3 className="font-medium">{pitch.name}</h3>
          {pitch.slots.length === 0 ? (
            <EmptyState
              {...hoursEmptyState(pitch.emptyKind ?? "closed")}
            />
          ) : (
            <ul className="flex flex-col gap-3">
              {pitch.slots.map((slot) => (
                <li key={slot.startIso}>
                  <Card>
                    <CardHeader className="gap-1">
                      <div className="flex items-center justify-between gap-2">
                        <CardTitle className="text-base">
                          <LtrIsolate>
                            {`${slot.startLocal}–${slot.endLocal}`}
                          </LtrIsolate>
                        </CardTitle>
                        {slot.available ? null : (
                          <Badge variant="outline">{ui("public.taken")}</Badge>
                        )}
                      </div>
                      <CardDescription>
                        <LtrIsolate>{`$${slot.priceUsd}`}</LtrIsolate>
                      </CardDescription>
                    </CardHeader>
                    {slot.available ? (
                      <CardContent>
                        <form
                          action={submitCreateOwnerBooking}
                          className="flex flex-col gap-4"
                        >
                          <input type="hidden" name="pitchId" value={pitch.id} />
                          <input type="hidden" name="start" value={slot.startIso} />
                          <input type="hidden" name="end" value={slot.endIso} />
                          {keepOwnerQuery(tenantSlug, bookOn, periodQuery)}
                          <div className="flex flex-col gap-2">
                            <Label htmlFor={`name-${slot.startIso}`}>
                              {ui("public.name")}
                            </Label>
                            <Input
                              id={`name-${slot.startIso}`}
                              type="text"
                              name="name"
                              required
                              autoComplete="name"
                            />
                          </div>
                          <div className="flex flex-col gap-2">
                            <Label htmlFor={`phone-${slot.startIso}`}>
                              {ui("public.phone")}
                            </Label>
                            <Input
                              id={`phone-${slot.startIso}`}
                              type="tel"
                              name="phone"
                              required
                              autoComplete="tel"
                              className="font-mono"
                            />
                          </div>
                          <SubmitButton className="w-full">{ui("owner.book")}</SubmitButton>
                        </form>
                      </CardContent>
                    ) : null}
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ul>
  );
}
