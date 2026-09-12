import { Suspense } from "react";
import { getCurrentTenant } from "@/lib/tenant-context";
import {
  requireOwnerMembership,
  tenantSlugFrom,
} from "@/app/owner/shared";
import { OwnerToday } from "./lists";
import { TodayListsSkeleton } from "./skeleton";
import { getUiLocale } from "@/lib/get-ui-locale";
import { ui } from "@/lib/ui-copy";

export default async function OwnerTodayPage({
  searchParams,
}: PageProps<"/owner/today">) {
  const tenant = await getCurrentTenant();
  const params = await searchParams;
  const tenantSlug = tenantSlugFrom(params, tenant.slug);
  const membership = await requireOwnerMembership(tenantSlug);
  const locale = await getUiLocale();

  return (
    <section className="flex flex-col gap-4">
      <h2 className="font-heading text-xl">{ui("owner.homeHeading", locale)}</h2>
      <Suspense fallback={<TodayListsSkeleton />}>
        <OwnerToday
          membership={membership}
          tenantSlug={tenantSlug}
          locale={locale}
        />
      </Suspense>
    </section>
  );
}
