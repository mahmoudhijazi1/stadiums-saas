import { freePitches } from "@/modules/booking/domain/free-times";
import { getDayAvailability, type OccupiedWindow } from "@/modules/venue/application/get-day-availability";
import { firstFreeDayAfter, type NextFreeTime, type WindowDay } from "@/modules/venue/application/get-window-summary";
import type { CivilDate } from "@/modules/venue/domain/availability";
import { weekdayLabel } from "@/modules/venue/ui/weekday-label";
import { PublicBooking, type NextFreeView } from "@/app/(public)/_components/booking";
import { NoFreeTimes } from "@/app/(public)/_components/no-free-times";
import { stadiumChatHref } from "@/app/(public)/_components/stadium-contact";
import { EmptyState } from "@/components/ui/empty-state";
import type { UiLocale } from "@/lib/locale";
import { getCurrentTenant } from "@/lib/tenant-context";
import { cancelPolicyLine, cancelUpToLine, ui } from "@/lib/copy";

const TIME_ZONE = "Asia/Beirut";

/** "Today", "Tomorrow", else "Fri 16". */
function dayLabelOf(day: CivilDate, today: CivilDate, locale: UiLocale): string {
  const offset = Math.round(
    (Date.UTC(day.year, day.month - 1, day.day) - Date.UTC(today.year, today.month - 1, today.day)) / 86_400_000,
  );
  if (offset === 0) return ui("public.today", locale);
  if (offset === 1) return ui("public.tomorrow", locale);
  return `${weekdayLabel(day, locale)} ${day.day}`;
}

/**
 * Thin day RSC. Occupied ranges and the window summary come from the page (loaded once); the day's
 * rows come from getDayAvailability. Taken times stay in the list (faded), started ones are gone.
 * When nothing is free the day says so and links to the next free day. Clocks follow
 * Tenant.settings.timeDisplay, same formatter as WhatsApp.
 */
export async function PublicHours({
  localDate,
  dateValue,
  locale,
  now,
  today,
  occupied,
  days,
  nextFree,
}: {
  localDate: CivilDate;
  dateValue: string;
  locale: UiLocale;
  now: Date;
  /** Business date (page's "Today" chip). */
  today: CivilDate;
  occupied: OccupiedWindow[];
  days: WindowDay[];
  nextFree: NextFreeTime | null;
}) {
  const tenant = await getCurrentTenant();
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

  const rows = pitches.filter((pitch) => pitch.slots.length > 0);
  const hasFree = freePitches(pitches).length > 0;
  const nextView: NextFreeView | null = nextFree
    ? {
        pitchId: nextFree.pitchId,
        pitchName: nextFree.pitchName,
        slot: {
          startIso: nextFree.startIso,
          endIso: nextFree.endIso,
          startLocal: nextFree.startLocal,
          endLocal: nextFree.endLocal,
          priceUsd: nextFree.priceUsd,
          available: true,
        },
        dateValue: nextFree.dateKey,
        dayLabel: dayLabelOf(nextFree.date, today, locale),
        durationMinutes: nextFree.durationMinutes,
      }
    : null;
  const nextFreeDay = hasFree ? null : firstFreeDayAfter(days, dateValue);

  return (
    <PublicBooking
      nextFree={nextView}
      pitches={rows}
      dateValue={dateValue}
      dayLabel={`${weekdayLabel(localDate, locale)} ${localDate.day}`}
      locale={locale}
      timeZone={TIME_ZONE}
      dayStartHour={tenant.dayStartHour}
      cancelLine={cancelUpToLine(tenant.cancellationWindowHours, locale) || null}
      feeLine={cancelPolicyLine(tenant.cancellationWindowHours, tenant.lateCancellationFeePercent, locale) || null}
      whatsappHref={stadiumChatHref(tenant.whatsapp)}
      emptyDay={hasFree ? null : <NoFreeTimes nextFree={nextFreeDay} locale={locale} />}
    />
  );
}

