import Link from "next/link";
import { OwnerBackLink } from "@/components/shell/back-link";
import { requireOwnerMembership } from "@/app/owner/require-owner";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { LtrIsolate } from "@/components/ui/ltr-isolate";
import { formatPrice } from "@/lib/format/money";
import { getUiLocale } from "@/lib/get-ui-locale";
import { ui } from "@/lib/copy";
import { SETTINGS_MANAGE, can } from "@/modules/access/domain/can";
import { getCurrentTenant } from "@/lib/tenant-context";
import { SettingsRow, SettingsSection } from "@/components/ui/settings-list";
import { listPitchSummaries, type PitchSummary } from "@/modules/venue/application/list-pitch-summaries";
import type { UiLocale } from "@/lib/locale";
import { formatHoursSummary, hoursToRows } from "@/modules/venue/domain/pitch-form-model";

/**
 * The pitch's price in the stadium's currency. USD reads exactly as before ("$20.00"). An LBP stadium
 * whose pitch misses a price in pounds says so instead of showing a dollar price (DR-007).
 */
function PitchPrice({ pitch, locale }: { pitch: PitchSummary; locale: UiLocale }) {
  if (pitch.defaultPrice?.currency === "USD") return <LtrIsolate>${pitch.defaultPrice.amount}</LtrIsolate>;
  if (pitch.defaultPrice && pitch.hasPrices) return <LtrIsolate>{formatPrice(pitch.defaultPrice, locale)}</LtrIsolate>;
  return <span className="text-owed">{ui("owner.pitchSetLbpPrices", locale)}</span>;
}

/**
 * Pitch list. Create and edit stay on the routes under this folder.
 */
export default async function PitchListPage() {
  const membership = await requireOwnerMembership();
  const locale = await getUiLocale();
  const tenant = await getCurrentTenant();
  const pitches = await listPitchSummaries(tenant.gamePriceCurrency);
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
                  <PitchPrice pitch={pitch} locale={locale} />
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
