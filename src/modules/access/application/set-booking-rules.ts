import { DomainError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import {
  mergeBookingRules,
  type BookingRulesInput,
} from "@/lib/tenant-settings";
import { getCurrentTenant, safeTenantId } from "@/lib/tenant-context";
import { rethrowUnexpected } from "@/lib/use-case-error";
import { getCurrentMembership } from "@/modules/access/application/get-current-membership";
import { SETTINGS_MANAGE, can } from "@/modules/access/domain/can";
import {
  findTenantSettingsById,
  updateTenantSettingsRow,
} from "@/modules/access/infrastructure/tenants";

/**
 * Persist cancellation window and fee percents. settings.manage.
 * Staff share the tenant policy; they cannot write without the flag.
 */
export async function setBookingRules(rules: BookingRulesInput): Promise<void> {
  const membership = await getCurrentMembership();
  if (!membership || !can(membership, SETTINGS_MANAGE)) {
    throw new DomainError("access.not_allowed");
  }

  const tenant = await getCurrentTenant();

  try {
    const current = await findTenantSettingsById(tenant.id);
    const next = mergeBookingRules(current, rules);
    await updateTenantSettingsRow(tenant.id, next);
    logger.info("Booking rules saved", undefined, {
      useCase: "setBookingRules",
      tenantId: await safeTenantId(),
    });
  } catch (error) {
    await rethrowUnexpected(error, "Set booking rules failed", "setBookingRules");
  }
}
