import { DomainError } from "@/lib/errors";
import {
  optionalAmountUsd,
  optionalNote,
  requireActor,
  requirePlan,
} from "@/modules/platform/domain/inputs";
import {
  findTenantBySlug,
  platformTransaction,
  writeAudit,
} from "@/modules/platform/infrastructure/platform-store";

/** Appends a Subscription row (never updates one). The latest row is the current plan. */
export async function setSubscription(input: {
  slug: string;
  plan: string;
  paidUntil: Date;
  amountUsd?: string | null;
  note?: string | null;
  actor: string;
}): Promise<void> {
  const actor = requireActor(input.actor);
  const plan = requirePlan(input.plan);
  const amountUsd = optionalAmountUsd(input.amountUsd);
  const note = optionalNote(input.note);
  const tenant = await findTenantBySlug(input.slug);
  if (!tenant) throw new DomainError("platform.tenant_not_found");

  await platformTransaction(async (tx) => {
    await tx.subscription.create({
      data: {
        tenantId: tenant.id,
        plan,
        startsAt: new Date(),
        paidUntil: input.paidUntil,
        amountUsd,
        note,
        recordedBy: actor,
      },
    });
    await writeAudit(tx, {
      action: "subscription.set",
      tenantId: tenant.id,
      actor,
      detail: { plan, paidUntil: input.paidUntil.toISOString(), amountUsd, note },
    });
  });
}
