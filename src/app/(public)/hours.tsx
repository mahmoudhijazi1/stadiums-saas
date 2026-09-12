import { listApprovedOccupied } from "@/modules/booking/application/list-approved-occupied";
import { getDayAvailability } from "@/modules/venue/application/get-day-availability";
import type { CivilDate } from "@/modules/venue/domain/availability";
import { PublicSlotPicker } from "./slot-picker";
import { EmptyState } from "@/components/ui/empty-state";
import type { UiLocale } from "@/lib/locale";
import { ui } from "@/lib/ui-copy";

const TIME_ZONE = "Asia/Beirut";

/**
 * Thin hours RSC. Occupied from Booking; Venue only UTC ranges (SPEC-05).
 * Slot tap UI lives in PublicSlotPicker (one Client Component).
 */
export async function PublicHours({
  localDate,
  dateValue,
  tenantSlug,
  locale,
  now,
}: {
  localDate: CivilDate;
  dateValue: string;
  tenantSlug: string;
  locale: UiLocale;
  now: Date;
}) {
  const occupied = await listApprovedOccupied();
  const pitches = await getDayAvailability({
    localDate,
    timeZone: TIME_ZONE,
    now,
    occupied,
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
      tenantSlug={tenantSlug}
      locale={locale}
    />
  );
}
