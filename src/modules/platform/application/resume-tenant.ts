import { DomainError } from "@/lib/errors";
import { requireActor } from "@/modules/platform/domain/inputs";
import { assertCanResume } from "@/modules/platform/domain/suspension";
import {
  findTenantBySlug,
  platformTransaction,
  writeAudit,
} from "@/modules/platform/infrastructure/platform-store";

/** Resume restores everything instantly: only the two suspension columns change. */
export async function resumeTenant(input: { slug: string; actor: string }): Promise<void> {
  const actor = requireActor(input.actor);
  const tenant = await findTenantBySlug(input.slug);
  if (!tenant) throw new DomainError("platform.tenant_not_found");
  assertCanResume(tenant);

  await platformTransaction(async (tx) => {
    const updated = await tx.tenant.updateMany({
      where: { id: tenant.id, suspendedAt: { not: null } },
      data: { suspendedAt: null, suspendedReason: null },
    });
    if (updated.count !== 1) throw new DomainError("platform.not_suspended");
    await writeAudit(tx, {
      action: "tenant.resume",
      tenantId: tenant.id,
      actor,
      detail: { suspendedAt: tenant.suspendedAt?.toISOString() ?? null },
    });
  });
}
