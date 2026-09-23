import { OwnerBackLink } from "@/app/owner/back-link";
import { queryString, requireOwnerMembership } from "@/app/owner/shared";
import { SETTINGS_MANAGE, can } from "@/modules/access/domain/can";
import { EmptyState } from "@/components/ui/empty-state";
import { getUiLocale } from "@/lib/get-ui-locale";
import { ui } from "@/lib/ui-copy";
import { submitCreatePitch } from "../actions";
import { PitchDraftForm } from "../form";
import {
  readHoursGroupsDraft,
  readPriceRulesDraft,
} from "@/modules/venue/schemas/pitch-draft";
import { defaultHoursGroups } from "@/modules/venue/domain/daily-schedule";

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
      <OwnerBackLink href="/owner/more/settings" locale={locale} />
      <h2 className="font-heading text-3xl lg:text-4xl">{ui("owner.pitchNew", locale)}</h2>
      <PitchDraftForm
        locale={locale}
        action={submitCreatePitch}
        defaults={{
          name: queryString(params.name) ?? "",
          hoursGroups:
            readHoursGroupsDraft(queryString(params.hoursGroupsJson)) ??
            defaultHoursGroups(),
          slotDurationMinutes: queryString(params.slotDurationMinutes) ?? "60",
          defaultPriceUsd: queryString(params.defaultPriceUsd) ?? "30.00",
          priceRules:
            readPriceRulesDraft(queryString(params.priceRulesJson)) ?? [],
        }}
        showPending={false}
      />
    </section>
  );
}
