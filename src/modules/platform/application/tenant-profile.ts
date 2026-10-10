import {
  findTenantBrandSource,
  findTenantNameAndSettings,
  platformTransaction,
  updateTenantNameAndSettings,
  writeAudit,
} from "@/modules/platform/infrastructure/platform-store";

/**
 * A tenant's own profile (name and settings) for the stadium module. The tenant id is always the
 * one of the current request (the caller takes it from `getCurrentTenantId`), never from input.
 */
export type TenantProfile = { name: string; settings: unknown };

export async function readTenantProfile(tenantId: string): Promise<TenantProfile> {
  return platformTransaction((tx) => findTenantNameAndSettings(tx, tenantId));
}

/**
 * Change name and settings in ONE transaction. `change` gets what is stored now and returns what
 * to store. A changed name writes a PlatformAuditLog row ("tenant.rename", from and to) with
 * `actor`; an unchanged name writes none.
 */
export async function updateTenantProfile(
  tenantId: string,
  actor: string,
  change: (current: TenantProfile) => { name: string; settings: Parameters<typeof updateTenantNameAndSettings>[2]["settings"] },
): Promise<void> {
  await platformTransaction(async (tx) => {
    const current = await findTenantNameAndSettings(tx, tenantId);
    const next = change(current);
    await updateTenantNameAndSettings(tx, tenantId, next);
    if (current.name !== next.name) {
      await writeAudit(tx, {
        action: "tenant.rename",
        tenantId,
        actor,
        detail: { from: current.name, to: next.name },
      });
    }
  });
}

/** What the brand loader needs of the stadium at a host slug (or null). */
export function readTenantBrandSource(slug: string) {
  return findTenantBrandSource(slug);
}
