"use client";

import { submitCreateOwnerBooking } from "./actions";
import { SlotPicker, type SlotPickerPitch } from "@/components/slot-picker";
import { ui } from "@/lib/ui-copy";

/**
 * Owner Book grid. Action + bookOn stay here; the picker is shared.
 * Auth is the /owner/book page, not this component.
 */
export function OwnerSlotPicker({
  pitches,
  tenantSlug,
  bookOn,
}: {
  pitches: SlotPickerPitch[];
  tenantSlug: string;
  bookOn: string;
}) {
  return (
    <SlotPicker
      pitches={pitches}
      action={submitCreateOwnerBooking}
      hiddenFields={{ tenant: tenantSlug, bookOn }}
      submitLabel={ui("owner.book")}
    />
  );
}
