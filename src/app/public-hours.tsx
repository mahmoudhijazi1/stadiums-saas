import { submitPublicSlotRequest } from "@/app/request-slot";
import { listApprovedOccupied } from "@/modules/booking/application/list-approved-occupied";
import { getDayAvailability } from "@/modules/venue/application/get-day-availability";
import type { CivilDate } from "@/modules/venue/domain/availability";
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
import { ui } from "@/lib/ui-copy";

const TIME_ZONE = "Asia/Beirut";

export async function PublicHours({
  localDate,
  dateValue,
  tenantSlug,
}: {
  localDate: CivilDate;
  dateValue: string;
  tenantSlug: string;
}) {
  const occupied = await listApprovedOccupied();
  const pitches = await getDayAvailability({
    localDate,
    timeZone: TIME_ZONE,
    occupied,
  });

  if (pitches.length === 0) {
    return (
      <EmptyState
        title={ui("public.emptyPitches")}
        next={ui("public.emptyPitchesNext")}
      />
    );
  }

  return (
    <ul className="flex flex-col gap-4">
      {pitches.map((pitch) => (
        <li key={pitch.id} className="flex flex-col gap-2">
          <h3 className="font-medium">{pitch.name}</h3>
          {pitch.slots.length === 0 ? (
            <EmptyState
              title={ui("public.closed")}
              next={ui("public.closedNext")}
            />
          ) : (
            <ul className="flex flex-col gap-2">
              {pitch.slots.map((slot) => (
                <li key={slot.startIso}>
                  <Card className="gap-4 py-4">
                    <CardHeader className="gap-1 px-4">
                      <div className="flex items-center justify-between gap-2">
                        <CardTitle className="font-mono text-base">
                          {slot.startLocal}–{slot.endLocal}
                        </CardTitle>
                        {slot.available ? null : (
                          <Badge variant="outline">{ui("public.taken")}</Badge>
                        )}
                      </div>
                      <CardDescription className="font-mono">
                        ${slot.priceUsd}
                      </CardDescription>
                    </CardHeader>
                    {slot.available ? (
                      <CardContent className="px-4">
                        <form
                          action={submitPublicSlotRequest}
                          className="flex flex-col gap-4"
                        >
                          <input
                            type="hidden"
                            name="pitchId"
                            value={pitch.id}
                          />
                          <input
                            type="hidden"
                            name="start"
                            value={slot.startIso}
                          />
                          <input type="hidden" name="end" value={slot.endIso} />
                          <input type="hidden" name="date" value={dateValue} />
                          <input
                            type="hidden"
                            name="tenant"
                            value={tenantSlug}
                          />
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
                          <SubmitButton className="w-full">
                            {ui("public.request")}
                          </SubmitButton>
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
