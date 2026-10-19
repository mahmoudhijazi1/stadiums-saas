import { OwnerBackLink } from "@/components/shell/back-link";
import { queryString } from "@/lib/search-params";
import { requireOwnerMembership } from "@/app/owner/require-owner";
import { SETTINGS_MANAGE, can } from "@/modules/access/domain/can";
import { EmptyState } from "@/components/ui/empty-state";
import { getUiLocale } from "@/lib/get-ui-locale";
import { ui } from "@/lib/copy";
import { getCurrentTenant } from "@/lib/tenant-context";
import { submitCreatePitch } from "../actions";
import { PitchDraftForm } from "@/app/owner/(app)/more/settings/pitches/_components/form";
import {
  readHoursGroupsDraft,
  readPriceRulesDraft,
} from "@/modules/venue/schemas/pitch-draft";
import { DEFAULT_FROM, DEFAULT_TO } from "@/modules/venue/domain/pitch-form-model";
import { WEEKDAYS } from "@/modules/venue/domain/schedule-config";

/**
 * Create pitch. settings.manage. Local Next page.md: searchParams is a Promise.
 */
export default async function NewPitchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const membership = await requireOwnerMembership();
  const locale = await getUiLocale();
  const tenant = await getCurrentTenant();

  if (!can(membership, SETTINGS_MANAGE)) {
    return (
      <EmptyState
        title={ui("empty.noPitchEdit", locale)}
        next={ui("empty.noPitchEditNext", locale)}
      />
    );
  }

  return (
    <section className="flex flex-col gap-4">
      <OwnerBackLink href="/owner/more/settings/pitches" locale={locale} />
      <h2 className="type-title">{ui("owner.pitchNew", locale)}</h2>
      <PitchDraftForm
        locale={locale}
        action={submitCreatePitch}
        defaults={{
          name: queryString(params.name) ?? "",
          hoursGroups:
            readHoursGroupsDraft(queryString(params.hoursGroupsJson)) ??
            [{ days: [...WEEKDAYS], open: DEFAULT_FROM, close: DEFAULT_TO }],
          slotDurationMinutes: queryString(params.slotDurationMinutes) ?? "60",
          defaultPlayerCount: queryString(params.defaultPlayerCount) ?? "10",
          // An LBP stadium types pounds; its USD default stays 0.00 ("never priced", DR-007).
          defaultPriceUsd: queryString(params.defaultPriceUsd) ?? (tenant.gamePriceCurrency === "LBP" ? "0.00" : "20.00"),
          defaultPriceLbp: queryString(params.defaultPriceLbp) ?? "",
          priceRules:
            readPriceRulesDraft(queryString(params.priceRulesJson)) ?? [],
        }}
        showPending={false}
        splitEnabled={tenant.perPlayerSplitEnabled}
        hourCycle={tenant.timeDisplay}
        dayStartHour={tenant.dayStartHour}
        currency={tenant.gamePriceCurrency}
      />
    </section>
  );
}
