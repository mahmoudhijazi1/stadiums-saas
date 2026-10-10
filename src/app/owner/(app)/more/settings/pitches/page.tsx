import Link from "next/link";
import { OwnerBackLink } from "@/app/owner/back-link";
import { requireOwnerMembership } from "@/app/owner/shared";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { LtrIsolate } from "@/components/ui/ltr-isolate";
import { getUiLocale } from "@/lib/get-ui-locale";
import { ui } from "@/lib/copy";
import { SETTINGS_MANAGE, can } from "@/modules/access/domain/can";
import { getCurrentTenant } from "@/lib/tenant-context";
import { SettingsRow, SettingsSection } from "../../settings-list";
import { listPitchSummaries } from "@/modules/venue/application/list-pitch-summaries";
import { formatHoursSummary, hoursToRows } from "@/modules/venue/domain/pitch-form-model";

/**
 * Pitch list. Create and edit stay on the routes under this folder.
 */
export default async function PitchListPage() {
  const membership = await requireOwnerMembership();
  const locale = await getUiLocale();
  const pitches = await listPitchSummaries();
  const tenant = await getCurrentTenant();
  const mayManage = can(membership, SETTINGS_MANAGE);

  return (
    <section className="flex flex-col gap-4">
      <OwnerBackLink href="/owner/more" locale={locale} />
      <div className="flex items-center justify-between gap-3">
        <h2 className="type-title">
          {ui("owner.pitches", locale)}
        </h2>
        {mayManage ? (
          <Button asChild variant="secondary" size="sm">
            <Link href="/owner/more/settings/pitches/new">
              {ui("owner.pitchNew", locale)}
            </Link>
          </Button>
        ) : null}
      </div>
      {pitches.length === 0 ? (
        <EmptyState
          title={ui("empty.pitches", locale)}
          next={ui("empty.pitchesNext", locale)}
        />
      ) : (
        <SettingsSection>
          {pitches.map((pitch) => (
            <SettingsRow
              key={pitch.id}
              strong
              label={pitch.name}
              detail={formatHoursSummary(hoursToRows(pitch.hoursGroups), locale, tenant.timeDisplay)}
              meta={
                <>
                  <LtrIsolate>{pitch.slotDurationMinutes}</LtrIsolate> {ui("owner.pitchMinutesFull", locale)}
                  {" · "}
                  <LtrIsolate>${pitch.defaultPriceUsd}</LtrIsolate>
                </>
              }
              href={mayManage ? `/owner/more/settings/pitches/${pitch.id}` : undefined}
            />
          ))}
        </SettingsSection>
      )}
    </section>
  );
}
