import { OwnerBackLink } from "@/app/owner/back-link";
import { requireOwnerMembership } from "@/app/owner/shared";
import { weeklyWeekdayAndTime } from "@/app/owner/(app)/series/labels";
import { EmptyState } from "@/components/ui/empty-state";
import { getUiLocale } from "@/lib/get-ui-locale";
import { getCurrentTenant } from "@/lib/tenant-context";
import { ui } from "@/lib/copy";
import { BOOKINGS_CREATE, can } from "@/modules/access/domain/can";
import { listWeeklyBookings } from "@/modules/booking/application/list-weekly-bookings";
import { hasSeveralPitches } from "@/modules/venue/application/has-several-pitches";
import { WeeklyList } from "./weekly-list";

/**
 * More > Business > Weekly bookings: every series that still has games left, soonest first, with
 * Renew. Any logged-in member may look; Renew needs bookings.create.
 */
export default async function WeeklyBookingsPage() {
  const membership = await requireOwnerMembership();
  const locale = await getUiLocale();
  const tenant = await getCurrentTenant();
  const rows = await listWeeklyBookings();
  const showPitch = await hasSeveralPitches();

  const items = rows.map((row) => {
    const { weekday, time } = weeklyWeekdayAndTime(row.anchor, locale, tenant.timeDisplay);
    return {
      seriesId: row.seriesId,
      personName: row.personName,
      when: ui("owner.weeklyEvery", locale).replace("{weekday}", weekday).replace("{time}", time),
      pitchName: showPitch ? row.pitchName : null,
      left: row.left,
    };
  });

  return (
    <section className="flex flex-col gap-4">
      <OwnerBackLink href="/owner/more" locale={locale} />
      <h1 className="type-title">{ui("owner.weeklyBookings", locale)}</h1>
      {items.length === 0 ? (
        <EmptyState title={ui("owner.weeklyEmpty", locale)} next={ui("owner.weeklyEmptyNext", locale)} compact />
      ) : (
        <WeeklyList items={items} mayRenew={can(membership, BOOKINGS_CREATE)} locale={locale} />
      )}
    </section>
  );
}
