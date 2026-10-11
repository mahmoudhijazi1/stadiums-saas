import { brandIconPath, brandIdentityOf } from "@/modules/stadium/domain/brand-identity";
import { getCurrentTenant } from "@/lib/tenant-context";
import { businessDate } from "@/modules/booking/domain/business-day";
import { clampPublicDay, lastPublicDay } from "@/modules/booking/domain/public-window";
import {
  formatCivilDate,
  type CivilDate,
} from "@/modules/venue/domain/availability";
import { DayStrip } from "@/modules/venue/ui/day-strip";
import { HeaderBand } from "@/app/(public)/_components/header-band";
import { listApprovedOccupied } from "@/modules/booking/application/list-approved-occupied";
import { getWindowSummary } from "@/modules/venue/application/get-window-summary";
import { availabilityLevel } from "@/modules/venue/domain/availability-level";
import { PublicHoursSkeleton } from "@/app/(public)/_components/skeletons";
import { PublicHours } from "@/app/(public)/_components/hours";
import { Container } from "@/components/ui/container";
import { UnavailableNotice } from "@/components/shell/unavailable-notice";
import { getUiLocale } from "@/lib/get-ui-locale";
import { ui } from "@/lib/copy";
import { Suspense } from "react";
import { setUiLocale } from "@/app/locale-actions";

/**
 * Thin route. No Prisma and no tenantId.
 * Occupied comes from Booking; Venue only receives UTC ranges (SPEC-05).
 * Date is ?date= yyyy-mm-dd via the day strip's Links (client transition, not a GET form), from
 * today to PUBLIC_FUTURE_DAYS; a past day shows today.
 * The times are a child RSC so the day strip stays mounted while they suspend.
 * "Today" is the business date (06:00 to 06:00 Beirut, same rule as owner Today): at
 * 00:30 it is still last night, so the rest of a window that crosses midnight stays
 * reachable. Started slots are never offered (dropEndedSlots / slot_ended).
 */
export default async function HomePage({ searchParams }: PageProps<"/">) {
  const tenant = await getCurrentTenant();
  const locale = await getUiLocale();
  // The (public) layout already shows the neutral page; never render tenant data here either.
  if (tenant.suspended) return <UnavailableNotice kind="public" locale={locale} onChangeLocale={setUiLocale} />;
  const params = await searchParams;
  const dateParam = typeof params.date === "string" ? params.date : undefined;
  const now = new Date();
  const today = businessDate(now, tenant.dayStartHour, "Asia/Beirut");
  // A date beyond the public window (PUBLIC_FUTURE_DAYS) shows today, like a bad date.
  const localDate = clampPublicDay(parseCivilDate(dateParam), today, today);
  const dateValue = formatCivilDate(localDate);

  const occupied = await listApprovedOccupied();
  const { days, nextFree } = await getWindowSummary({
    from: today,
    lastDay: lastPublicDay(today),
    timeZone: "Asia/Beirut",
    now,
    occupied,
    hourCycle: tenant.timeDisplay,
    locale,
  });
  const levels = Object.fromEntries(days.map((day) => [day.key, availabilityLevel(day.freeCount)]));

  return (
    <main>
    <Container className="flex flex-col gap-6 py-8">
      <HeaderBand
        name={tenant.name}
        address={tenant.address}
        logoSrc={brandIconPath("192", brandIdentityOf(tenant))}
        mapLink={tenant.mapLink}
        phone={tenant.phone}
        whatsapp={tenant.whatsapp}
        locale={locale}
        onChangeLocale={setUiLocale}
      />

      <DayStrip
        today={today}
        lastDay={lastPublicDay(today)}
        selectedDate={dateValue}
        pathname="/"
        dateQueryKey="date"
        levels={levels}
        locale={locale}
      />

      <section className="flex flex-col gap-4">
        <Suspense key={dateValue} fallback={<PublicHoursSkeleton />}>
          <PublicHours
            localDate={localDate}
            dateValue={dateValue}
            locale={locale}
            now={now}
            today={today}
            occupied={occupied}
            days={days}
            nextFree={nextFree}
          />
        </Suspense>
      </section>

      <footer className="pt-4 text-center type-caption text-ink-muted">
        {ui("public.poweredBy", locale)}
      </footer>
    </Container>
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
