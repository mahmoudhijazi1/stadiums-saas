import { brandIdentityOf, type BrandIdentity } from "@/modules/stadium/domain/brand-identity";
import { parseTenantSettings } from "@/lib/tenant-settings";
import { readTenantBrandSource } from "@/modules/platform/application/tenant-profile";

/**
 * The logo identity of the stadium at a host slug: one symbol and a preset key, or null for the
 * neutral lebstads icon (unknown slug, suspended stadium). Public by design: the logo is shown on
 * the public page. It returns the symbol only, never the name. The slug comes from the validated
 * Host (resolveTenantFromHeaders), never from a query or a header the caller can set.
 */
export async function loadBrandIdentity(slug: string): Promise<BrandIdentity | null> {
  const tenant = await readTenantBrandSource(slug);
  if (!tenant || tenant.suspendedAt) return null;
  const settings = parseTenantSettings(tenant.settings);
  return brandIdentityOf({ name: tenant.name, brandPreset: settings.brandPreset });
}
