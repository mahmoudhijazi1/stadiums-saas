import { listApprovedOccupied } from "@/modules/booking/application/list-approved-occupied";
import { freePitches } from "@/modules/booking/domain/free-times";
import { lastPublicDay } from "@/modules/booking/domain/public-window";
import { getDayAvailability } from "@/modules/venue/application/get-day-availability";
import { findNextFreeDay } from "@/modules/venue/application/find-next-free-day";
import type { CivilDate } from "@/modules/venue/domain/availability";
import { PublicTimes } from "@/app/(public)/_components/times";
import { stadiumChatHref } from "@/app/(public)/_components/stadium-contact";
import { weekdayLabel } from "@/modules/venue/ui/weekday-label";
import { NoFreeTimes } from "@/app/(public)/_components/no-free-times";
import { EmptyState } from "@/components/ui/empty-state";
import type { UiLocale } from "@/lib/locale";
import { getCurrentTenant } from "@/lib/tenant-context";
import { cancelPolicyLine, cancelUpToLine, ui } from "@/lib/copy";

const TIME_ZONE = "Asia/Beirut";

/**
 * Thin times RSC. Occupied from Booking; Venue only UTC ranges (SPEC-05).
 * Only free times reach the chips (taken and already-started ones are dropped). When the day has
 * none, the next day with a free time is looked up (one extra query, the pitches) for the link.
 * Clocks follow Tenant.settings.timeDisplay, same formatter as WhatsApp.
 */
export async function PublicHours({
  localDate,
  dateValue,
  locale,
  now,
  today,
}: {
  localDate: CivilDate;
  dateValue: string;
  locale: UiLocale;
  now: Date;
  /** Business date (page's "Today" chip). */
  today: CivilDate;
}) {
  const tenant = await getCurrentTenant();
  const occupied = await listApprovedOccupied();
  const pitches = await getDayAvailability({
    localDate,
    timeZone: TIME_ZONE,
    now,
    today,
    occupied,
    hourCycle: tenant.timeDisplay,
    locale,
  });

  if (pitches.length === 0) {
    return (
      <EmptyState
        title={ui("public.emptyPitches", locale)}
        next={ui("public.emptyPitchesNext", locale)}
      />
    );
  }

  const free = freePitches(pitches);
  if (free.length === 0) {
    const nextFree = await findNextFreeDay({
      after: localDate,
      lastDay: lastPublicDay(today),
      timeZone: TIME_ZONE,
      now,
      occupied,
    });
    return <NoFreeTimes nextFree={nextFree} locale={locale} />;
  }

  return (
    <PublicTimes
      pitches={free}
      dateValue={dateValue}
      dayLabel={`${weekdayLabel(localDate, locale)} ${localDate.day}`}
      locale={locale}
      cancelLine={cancelUpToLine(tenant.cancellationWindowHours, locale) || null}
      feeLine={cancelPolicyLine(tenant.cancellationWindowHours, tenant.lateCancellationFeePercent, locale) || null}
      whatsappHref={stadiumChatHref(tenant.whatsapp)}
    />
  );
}
