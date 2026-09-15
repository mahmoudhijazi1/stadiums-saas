import { DomainError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import {
  mergeTenantTimeDisplay,
  type TimeDisplay,
} from "@/lib/tenant-settings";
import { getCurrentTenant, safeTenantId } from "@/lib/tenant-context";
import { rethrowUnexpected } from "@/lib/use-case-error";
import { getCurrentMembership } from "@/modules/access/application/get-current-membership";
import {
  findTenantSettingsById,
  updateTenantSettingsRow,
} from "@/modules/access/infrastructure/tenants";

/**
 * Persist owner clock preference on Tenant.settings. OWNER only.
 * Staff share the same clocks (tenant-level); they cannot write.
 */
export async function setTimeDisplay(timeDisplay: TimeDisplay): Promise<void> {
  const membership = await getCurrentMembership();
  if (!membership || membership.role !== "OWNER") {
    throw new DomainError("access.not_allowed");
  }

  const tenant = await getCurrentTenant();

  try {
    const current = await findTenantSettingsById(tenant.id);
    const next = mergeTenantTimeDisplay(current, timeDisplay);
    await updateTenantSettingsRow(tenant.id, next);
    logger.info(`Time display set ${timeDisplay}`, undefined, {
      useCase: "setTimeDisplay",
      tenantId: await safeTenantId(),
    });
  } catch (error) {
    await rethrowUnexpected(error, "Set time display failed", "setTimeDisplay");
  }
}
