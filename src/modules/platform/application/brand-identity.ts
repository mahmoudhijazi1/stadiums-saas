import { brandIdentityOf, type BrandIdentity } from "@/lib/brand-identity";
import { parseTenantSettings } from "@/lib/tenant-settings";
import { findTenantBrandSource } from "@/modules/platform/infrastructure/platform-store";

/**
 * The logo identity of the stadium at a host slug: one symbol and a preset key, or null for the
 * neutral lebstads icon (unknown slug, suspended stadium). Public by design: the logo is shown on
 * the public page. It returns the symbol only, never the name. The slug comes from the validated
 * Host (resolveTenantFromHeaders), never from a query or a header the caller can set.
 */
export async function loadBrandIdentity(slug: string): Promise<BrandIdentity | null> {
  const tenant = await findTenantBrandSource(slug);
  if (!tenant || tenant.suspendedAt) return null;
  const settings = parseTenantSettings(tenant.settings);
  return brandIdentityOf({ name: tenant.name, brandPreset: settings.brandPreset });
}
