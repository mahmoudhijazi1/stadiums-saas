import { Suspense } from "react";
import { getCurrentTenant } from "@/lib/tenant-context";
import {
  requireOwnerMembership,
  tenantSlugFrom,
} from "@/app/owner/shared";
import { OwnerWaitlist } from "./list";
import { WaitlistSkeleton } from "./skeleton";
import { ui } from "@/lib/ui-copy";

export default async function OwnerWaitlistPage({
  searchParams,
}: PageProps<"/owner/waitlist">) {
  const tenant = await getCurrentTenant();
  const params = await searchParams;
  const tenantSlug = tenantSlugFrom(params, tenant.slug);
  await requireOwnerMembership(tenantSlug);

  return (
    <section className="flex flex-col gap-4">
      <h2 className="font-heading text-xl">{ui("owner.waitlist")}</h2>
      <Suspense fallback={<WaitlistSkeleton />}>
        <OwnerWaitlist />
      </Suspense>
    </section>
  );
}
