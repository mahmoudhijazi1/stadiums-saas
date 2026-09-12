import { listApprovedOccupied } from "@/modules/booking/application/list-approved-occupied";
import { getDayAvailability } from "@/modules/venue/application/get-day-availability";
import { civilFromYyyyMmDd } from "./date";
import { OwnerSlotPicker } from "./picker";
import { OWNER_TIME_ZONE } from "@/app/owner/shared";
import { EmptyState } from "@/components/ui/empty-state";
import { ui } from "@/lib/ui-copy";

/**
 * Thin Book RSC. Occupied from Booking; Venue only UTC ranges.
 * Slot tap UI lives in OwnerSlotPicker (shared SlotPicker).
 */
export async function OwnerBookSlots({
  tenantSlug,
  bookOn,
}: {
  tenantSlug: string;
  bookOn: string;
}) {
  const pitches = await getDayAvailability({
    localDate: civilFromYyyyMmDd(bookOn),
    timeZone: OWNER_TIME_ZONE,
    now: new Date(),
    occupied: await listApprovedOccupied(),
  });

  if (pitches.length === 0) {
    return (
      <EmptyState
        title={ui("empty.pitches")}
        next={ui("empty.pitchesNext")}
      />
    );
  }

  return (
    <OwnerSlotPicker
      pitches={pitches}
      tenantSlug={tenantSlug}
      bookOn={bookOn}
    />
  );
}
