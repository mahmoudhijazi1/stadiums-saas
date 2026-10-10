import { cache } from "react";
import { headers } from "next/headers";
import type { BrandIdentity } from "@/lib/brand-identity";
import { resolveTenantFromHeaders } from "@/lib/tenant-slug";
import { loadBrandIdentity } from "@/modules/platform/application/brand-identity";

/**
 * The logo identity of the stadium the request's Host names, or null (neutral lebstads icon) for
 * the apex, an invalid host, an unknown or a suspended stadium. The tenant comes from the
 * validated Host only (resolveTenantFromHeaders): no query value, no other header.
 */
export const currentBrandIdentity = cache(async (): Promise<BrandIdentity | null> => {
  const resolved = resolveTenantFromHeaders(await headers());
  return resolved.kind === "tenant" ? loadBrandIdentity(resolved.slug) : null;
});
