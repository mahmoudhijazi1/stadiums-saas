import { getCurrentTenant } from "@/lib/tenant-context";
import { errorMessage } from "@/lib/error-messages";
import { submitPublicSlotRequest } from "@/app/request-slot";
import { listApprovedOccupied } from "@/modules/booking/application/list-approved-occupied";
import { getDayAvailability } from "@/modules/venue/application/get-day-availability";
import type { CivilDate } from "@/modules/venue/domain/availability";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DateField } from "@/components/ui/date-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Thin route. No Prisma and no tenantId.
 * Occupied comes from Booking; Venue only receives UTC ranges (SPEC-05).
 * Next 16: searchParams is a Promise; <form action={Server Action}> (forms guide).
 * Date GET uses DateField hidden name="date" (same yyyy-mm-dd as before).
 */
const TIME_ZONE = "Asia/Beirut";

export default async function HomePage({ searchParams }: PageProps<"/">) {
  const tenant = await getCurrentTenant();
  const params = await searchParams;
  const dateParam = typeof params.date === "string" ? params.date : undefined;
  const localDate = parseCivilDate(dateParam) ?? todayInTimeZone(TIME_ZONE);
  const occupied = await listApprovedOccupied();
  const pitches = await getDayAvailability({
    localDate,
    timeZone: TIME_ZONE,
    occupied,
  });
  const received = params.received === "1";
  const errorKey = typeof params.error === "string" ? params.error : undefined;
  const dateValue = formatCivilDate(localDate);

  return (
    <main className="mx-auto flex w-full max-w-lg flex-col gap-6 px-6 py-6">
      <header>
        <h1 className="font-heading text-2xl">{tenant.name}</h1>
        <p className="font-mono text-sm text-muted-foreground">{tenant.slug}</p>
      </header>

      <form method="get" action="/" className="flex flex-col gap-3">
        <input type="hidden" name="tenant" value={tenant.slug} />
        <div className="flex flex-col gap-2">
          <Label htmlFor="date">Day</Label>
          <DateField id="date" name="date" required defaultValue={dateValue} />
        </div>
        <Button type="submit" variant="secondary" className="w-full">
          Show slots
        </Button>
      </form>

      <p className="text-sm text-muted-foreground">
        Schedule for <span className="font-mono">{dateValue}</span> ({TIME_ZONE})
      </p>

      {received ? (
        <p className="text-sm">Request received</p>
      ) : null}
      {errorKey ? (
        <p className="text-sm text-destructive" role="alert">
          {errorMessage(errorKey)}
        </p>
      ) : null}

      <section className="flex flex-col gap-4">
        <h2 className="font-heading text-xl">Pitches</h2>
        {pitches.length === 0 ? (
          <p className="text-sm text-muted-foreground">No pitches yet.</p>
        ) : (
          <ul className="flex flex-col gap-4">
            {pitches.map((pitch) => (
              <li key={pitch.id} className="flex flex-col gap-2">
                <h3 className="font-medium">{pitch.name}</h3>
                {pitch.slots.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Closed / No slots.
                  </p>
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
                                <Badge variant="outline">Taken</Badge>
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
                                className="flex flex-col gap-3"
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
                                <input
                                  type="hidden"
                                  name="end"
                                  value={slot.endIso}
                                />
                                <input
                                  type="hidden"
                                  name="date"
                                  value={dateValue}
                                />
                                <input
                                  type="hidden"
                                  name="tenant"
                                  value={tenant.slug}
                                />
                                <div className="flex flex-col gap-2">
                                  <Label htmlFor={`name-${slot.startIso}`}>
                                    Name
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
                                    Phone
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
                                <Button type="submit" className="w-full">
                                  Request
                                </Button>
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
        )}
      </section>
    </main>
  );
}

function parseCivilDate(value: string | undefined): CivilDate | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const utc = new Date(Date.UTC(year, month - 1, day));
  if (
    utc.getUTCFullYear() !== year ||
    utc.getUTCMonth() !== month - 1 ||
    utc.getUTCDate() !== day
  ) {
    return null;
  }
  return { year, month, day };
}

function todayInTimeZone(timeZone: string): CivilDate {
  const dtf = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const map: Record<string, string> = {};
  for (const part of dtf.formatToParts(new Date())) {
    if (part.type !== "literal") map[part.type] = part.value;
  }
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
  };
}

function formatCivilDate(date: CivilDate): string {
  const month = String(date.month).padStart(2, "0");
  const day = String(date.day).padStart(2, "0");
  return `${date.year}-${month}-${day}`;
}
