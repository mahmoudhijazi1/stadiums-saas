import Link from "next/link";
import { queryString, requireOwnerMembership } from "@/app/owner/shared";
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
 * Create pitch. OWNER only. Local Next page.md: searchParams is a Promise.
 */
export default async function NewPitchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const membership = await requireOwnerMembership();
  const locale = await getUiLocale();

  if (membership.role !== "OWNER") {
    return (
      <EmptyState
        title={ui("empty.noPitchEdit", locale)}
        next={ui("empty.noPitchEditNext", locale)}
      />
    );
  }

  return (
    <section className="flex flex-col gap-4">
      <Link
        href="/owner/more/settings"
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        {ui("owner.pitchBack", locale)}
      </Link>
      <h2 className="font-heading text-xl">{ui("owner.pitchNew", locale)}</h2>
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
