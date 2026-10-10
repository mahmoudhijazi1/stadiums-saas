import { loadFreeStrip } from "@/modules/booking/application/load-free-strip";
import { BOOKINGS_CREATE, can } from "@/modules/access/domain/can";
import type { CurrentMembership } from "@/modules/access/application/get-current-membership";
import type { UiLocale } from "@/lib/locale";
import { ui } from "@/lib/copy";
import { FreeStrip } from "@/modules/booking/ui/free-strip";
import { previewSeriesAction } from "@/app/owner/(app)/series/actions";
import { submitCreateOwnerBooking } from "@/app/owner/(app)/book/actions";

/** Server half of the free strip. Rendered in its own Suspense so it never blocks the list. */
export async function FreeStripSection({
  membership,
  locale,
  date,
}: {
  membership: CurrentMembership;
  locale: UiLocale;
  date?: string;
}) {
  const strip = await loadFreeStrip(date);
  if (strip.kind === "none") return null;
  if (strip.kind === "closed") {
    return <p className="text-sm text-muted-foreground">{ui("owner.closedCell", locale)}</p>;
  }
  return (
    <FreeStrip previewSeriesAction={previewSeriesAction} submitCreateOwnerBooking={submitCreateOwnerBooking}
      pitches={strip.pitches}
      showPitchNames={strip.showPitchNames}
      day={strip.day}
      mayBook={can(membership, BOOKINGS_CREATE)}
      locale={locale}
    />
  );
}
