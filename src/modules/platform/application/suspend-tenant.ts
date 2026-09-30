import { DomainError } from "@/lib/errors";
import { requireActor } from "@/modules/platform/domain/inputs";
import { assertCanSuspend } from "@/modules/platform/domain/suspension";
import {
  findTenantBySlug,
  platformTransaction,
  writeAudit,
} from "@/modules/platform/infrastructure/platform-store";

/**
 * Manual suspension (decisions 2 and 7). Sessions and data are not touched;
 * enforcement is at the tenant choke point. The reason is operator-only.
 */
export async function suspendTenant(input: { slug: string; reason: string; actor: string }): Promise<void> {
  const actor = requireActor(input.actor);
  const tenant = await findTenantBySlug(input.slug);
  if (!tenant) throw new DomainError("platform.tenant_not_found");
  assertCanSuspend(tenant, input.reason);
  const reason = input.reason.trim();

  await platformTransaction(async (tx) => {
    const updated = await tx.tenant.updateMany({
      where: { id: tenant.id, suspendedAt: null },
      data: { suspendedAt: new Date(), suspendedReason: reason },
    });
    if (updated.count !== 1) throw new DomainError("platform.already_suspended");
    await writeAudit(tx, { action: "tenant.suspend", tenantId: tenant.id, actor, detail: { reason } });
  });
}
