import { getCurrentTenant } from "@/lib/tenant-context";
import type { CivilDate } from "@/modules/venue/domain/availability";
import { HoursListSkeleton } from "@/app/list-skeletons";
import { PublicHours } from "@/app/public-hours";
import { Button } from "@/components/ui/button";
import { DateField } from "@/components/ui/date-field";
import { FlashToast } from "@/components/ui/flash-toast";
import { Label } from "@/components/ui/label";
import { ui } from "@/lib/ui-copy";
import { Suspense } from "react";

/**
 * Thin route. No Prisma and no tenantId.
 * Occupied comes from Booking; Venue only receives UTC ranges (SPEC-05).
 * Next 16: searchParams is a Promise; <form action={Server Action}> (forms guide).
 * Date GET uses DateField hidden name="date" (same yyyy-mm-dd as before).
 * Hours list is a child RSC so Show hours keeps the date field mounted.
 */
export default async function HomePage({ searchParams }: PageProps<"/">) {
  const tenant = await getCurrentTenant();
  const params = await searchParams;
  const dateParam = typeof params.date === "string" ? params.date : undefined;
  const localDate = parseCivilDate(dateParam) ?? todayInTimeZone("Asia/Beirut");
  const ok =
    typeof params.ok === "string"
      ? params.ok
      : params.received === "1"
        ? "requested"
        : undefined;
  const errorKey = typeof params.error === "string" ? params.error : undefined;
  const dateValue = formatCivilDate(localDate);
  const keep = new URLSearchParams();
  keep.set("tenant", tenant.slug);
  keep.set("date", dateValue);

  return (
    <main className="mx-auto flex w-full max-w-lg flex-col gap-6 px-6 py-8">
      <FlashToast ok={ok} error={errorKey} keepQuery={keep.toString()} />
      <header>
        <h1 className="font-heading text-2xl">{tenant.name}</h1>
      </header>

      <form method="get" action="/" className="flex flex-col gap-3">
        <input type="hidden" name="tenant" value={tenant.slug} />
        <div className="flex flex-col gap-2">
          <Label htmlFor="date">{ui("public.day")}</Label>
          <DateField id="date" name="date" required defaultValue={dateValue} />
        </div>
        <Button type="submit" variant="secondary" className="w-full">
          {ui("public.showHours")}
        </Button>
      </form>

      <section className="flex flex-col gap-4">
        <h2 className="font-heading text-xl">{ui("public.hours")}</h2>
        <Suspense key={dateValue} fallback={<HoursListSkeleton />}>
          <PublicHours
            localDate={localDate}
            dateValue={dateValue}
            tenantSlug={tenant.slug}
          />
        </Suspense>
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
