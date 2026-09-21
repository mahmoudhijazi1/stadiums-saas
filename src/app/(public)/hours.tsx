import { listApprovedOccupied } from "@/modules/booking/application/list-approved-occupied";
import { getDayAvailability } from "@/modules/venue/application/get-day-availability";
import type { CivilDate } from "@/modules/venue/domain/availability";
import { PublicSlotPicker } from "./slot-picker";
import { EmptyState } from "@/components/ui/empty-state";
import type { UiLocale } from "@/lib/locale";
import { getCurrentTenant } from "@/lib/tenant-context";
import { ui } from "@/lib/ui-copy";

const TIME_ZONE = "Asia/Beirut";

/**
 * Thin hours RSC. Occupied from Booking; Venue only UTC ranges (SPEC-05).
 * Slot tap UI lives in PublicSlotPicker → shared SlotPicker.
 * Clocks follow Tenant.settings.timeDisplay (WhatsApp bodies stay 24h).
 */
export async function PublicHours({
  localDate,
  dateValue,
  locale,
  now,
}: {
  localDate: CivilDate;
  dateValue: string;
  locale: UiLocale;
  now: Date;
}) {
  const tenant = await getCurrentTenant();
  const occupied = await listApprovedOccupied();
  const pitches = await getDayAvailability({
    localDate,
    timeZone: TIME_ZONE,
    now,
    occupied,
    hourCycle: tenant.timeDisplay,
  });

  if (pitches.length === 0) {
    return (
      <EmptyState
        title={ui("public.emptyPitches", locale)}
        next={ui("public.emptyPitchesNext", locale)}
      />
    );
  }

  return (
    <PublicSlotPicker
      pitches={pitches}
      dateValue={dateValue}
      locale={locale}
    />
  );
}
