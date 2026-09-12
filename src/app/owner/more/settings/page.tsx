import { Suspense } from "react";
import { getCurrentTenant } from "@/lib/tenant-context";
import {
  requireOwnerMembership,
  tenantSlugFrom,
} from "@/app/owner/shared";
import { OwnerSettings } from "./panel";
import { SettingsSkeleton } from "./skeleton";
import { getUiLocale } from "@/lib/get-ui-locale";
import { ui } from "@/lib/ui-copy";

/**
 * Settings. Rate set form lives here (was Money). No loading.tsx.
 * Local Next page.md: searchParams is a Promise.
 */
export default async function OwnerSettingsPage({
  searchParams,
}: PageProps<"/owner/more/settings">) {
  const tenant = await getCurrentTenant();
  const params = await searchParams;
  const tenantSlug = tenantSlugFrom(params, tenant.slug);
  const membership = await requireOwnerMembership(tenantSlug);
  const locale = await getUiLocale();

  return (
    <section className="flex flex-col gap-4">
      <h2 className="font-heading text-xl">{ui("owner.settings", locale)}</h2>
      <Suspense fallback={<SettingsSkeleton />}>
        <OwnerSettings
          membership={membership}
          tenantSlug={tenantSlug}
          locale={locale}
        />
      </Suspense>
    </section>
  );
}
