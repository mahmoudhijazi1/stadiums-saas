import { redirect } from "next/navigation";
import { getCurrentTenant } from "@/lib/tenant-context";
import { tenantSlugFrom } from "@/app/owner/shared";

/**
 * /owner has no UI. Landing tab is /owner/today (docs/owner-ia.md).
 * Login redirects there directly; this hop is for old bookmarks.
 */
export default async function OwnerIndexPage({
  searchParams,
}: PageProps<"/owner">) {
  const tenant = await getCurrentTenant();
  const params = await searchParams;
  const next = new URLSearchParams();
  next.set("tenant", tenantSlugFrom(params, tenant.slug));
  redirect(`/owner/today?${next.toString()}`);
}
