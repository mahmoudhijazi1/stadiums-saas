import { platformDb } from "@/lib/platform-db";
import type { TenantSettings } from "@/lib/tenant-settings";

export async function findTenantSettingsById(
  tenantId: string,
): Promise<unknown> {
  const row = await platformDb.tenant.findUniqueOrThrow({
    where: { id: tenantId },
    select: { settings: true },
  });
  return row.settings;
}

export async function updateTenantSettingsRow(
  tenantId: string,
  settings: TenantSettings,
): Promise<void> {
  await platformDb.tenant.update({
    where: { id: tenantId },
    data: { settings },
  });
}
