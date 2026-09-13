import Link from "next/link";
import { getCurrentTenant } from "@/lib/tenant-context";
import {
  queryString,
  requireOwnerMembership,
  tenantSlugFrom,
} from "@/app/owner/shared";
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
  const tenant = await getCurrentTenant();
  const params = await searchParams;
  const tenantSlug = tenantSlugFrom(params, tenant.slug);
  const membership = await requireOwnerMembership(tenantSlug);
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
        href={{
          pathname: "/owner/more/settings",
          query: { tenant: tenantSlug },
        }}
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        {ui("owner.pitchBack", locale)}
      </Link>
      <h2 className="font-heading text-xl">{ui("owner.pitchNew", locale)}</h2>
      <PitchDraftForm
        tenantSlug={tenantSlug}
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
