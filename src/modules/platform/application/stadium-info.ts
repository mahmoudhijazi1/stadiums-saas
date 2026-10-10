import type { BrandPresetKey } from "@/lib/brand-presets";
import { DomainError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { getCurrentTenantId, safeTenantId } from "@/lib/tenant-context";
import { mergeStadiumInfo, parseTenantSettings } from "@/lib/tenant-settings";
import { rethrowUnexpected } from "@/lib/use-case-error";
import { getCurrentMembership } from "@/modules/access/application/get-current-membership";
import { SETTINGS_MANAGE, can } from "@/modules/access/domain/can";
import { parseStadiumInfo } from "@/modules/platform/domain/stadium-info";
import {
  findTenantNameAndSettings,
  platformTransaction,
  updateTenantNameAndSettings,
  writeAudit,
} from "@/modules/platform/infrastructure/platform-store";

export type StadiumInfo = {
  name: string;
  address: string;
  mapLink: string;
  phone: string;
  whatsappSame: boolean;
  whatsapp: string;
  brandPreset: BrandPresetKey;
};

async function requireManager() {
  const membership = await getCurrentMembership();
  if (!membership || !can(membership, SETTINGS_MANAGE)) {
    throw new DomainError("access.not_allowed");
  }
  return membership;
}

/** What the "Stadium info" form shows now. settings.manage. */
export async function loadStadiumInfo(): Promise<StadiumInfo> {
  await requireManager();
  const tenantId = await getCurrentTenantId();
  const row = await platformTransaction((tx) => findTenantNameAndSettings(tx, tenantId));
  const settings = parseTenantSettings(row.settings);
  return {
    name: row.name,
    address: settings.address,
    mapLink: settings.mapLink,
    phone: settings.phone,
    whatsappSame: settings.whatsappSame,
    whatsapp: settings.whatsapp,
    brandPreset: settings.brandPreset,
  };
}

/**
 * Save the stadium's own name and info. settings.manage.
 *
 * The tenant is the one of this request (`getCurrentTenantId`, from the host); no id and no slug
 * come from the input, and the slug is never written. The name (Tenant.name) and the info
 * (Tenant.settings) change in ONE transaction; a changed name writes a PlatformAuditLog row
 * ("tenant.rename", from and to) with the member as actor. An unchanged name writes no audit row.
 */
export async function saveStadiumInfo(raw: unknown): Promise<void> {
  const membership = await requireManager();
  const info = parseStadiumInfo(raw);
  const tenantId = await getCurrentTenantId();

  try {
    await platformTransaction(async (tx) => {
      const current = await findTenantNameAndSettings(tx, tenantId);
      const settings = mergeStadiumInfo(current.settings, {
        address: info.address,
        mapLink: info.mapLink,
        phone: info.phone,
        whatsappSame: info.whatsappSame,
        whatsapp: info.whatsapp,
        brandPreset: info.brandPreset,
      });
      await updateTenantNameAndSettings(tx, tenantId, { name: info.name, settings });
      if (current.name !== info.name) {
        await writeAudit(tx, {
          action: "tenant.rename",
          tenantId,
          actor: `owner:${membership.userId}`,
          detail: { from: current.name, to: info.name },
        });
      }
    });
    logger.info("Stadium info saved", undefined, { useCase: "saveStadiumInfo", tenantId: await safeTenantId() });
  } catch (error) {
    await rethrowUnexpected(error, "Save stadium info failed", "saveStadiumInfo");
  }
}
