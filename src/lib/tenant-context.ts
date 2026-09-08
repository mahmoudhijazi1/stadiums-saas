import { cache } from "react";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { platformDb } from "@/lib/platform-db";

/**
 * Resolve the current tenant for this request.
 *
 * 1. Read x-tenant-slug (set by proxy in Step 2)
 * 2. Load that row from Tenant with platformDb
 * 3. If missing header or unknown slug → 404
 *
 * React cache() = one lookup per request if called multiple times.
 */
export const getCurrentTenant = cache(async () => {
  const slug = (await headers()).get("x-tenant-slug");
  if (!slug) {
    notFound();
  }

  const tenant = await platformDb.tenant.findUnique({
    where: { slug },
  });

  if (!tenant) {
    notFound();
  }

  return tenant;
});

export async function getCurrentTenantId(): Promise<string> {
  const tenant = await getCurrentTenant();
  return tenant.id;
}
