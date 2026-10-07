import { DomainError } from "@/lib/errors";
import { parseTenantSettings } from "@/lib/tenant-settings";
import { hashPassword } from "@/modules/access/infrastructure/password";
import {
  optionalDayStartHour,
  ownerIdentifierFor,
  requireActor,
  requireOwnerPassword,
  requirePlan,
  requireSlug,
  requireTenantName,
} from "@/modules/platform/domain/inputs";
import {
  isUniqueViolation,
  platformTransaction,
  writeAudit,
} from "@/modules/platform/infrastructure/platform-store";

/** Plan label when none is given (decision 5: a label only, no limits). */
export const DEFAULT_PLAN = "basic";

export type CreateTenantInput = {
  slug: string;
  name: string;
  plan?: string | null;
  paidUntil?: Date | null;
  ownerIdentifier?: string | null;
  /** Local hour a business day starts, 0..6 (a string from the CLI). Absent: 6. */
  dayStartHour?: string | number | null;
  ownerPassword: string;
  actor: string;
};

/** Checks everything that needs no database, so an interface can fail before prompting. */
export function validateCreateTenantInput(input: Omit<CreateTenantInput, "ownerPassword">) {
  const slug = requireSlug(input.slug);
  return {
    slug,
    name: requireTenantName(input.name),
    plan: requirePlan(input.plan ?? DEFAULT_PLAN),
    paidUntil: input.paidUntil ?? null,
    ownerIdentifier: ownerIdentifierFor(slug, input.ownerIdentifier),
    dayStartHour: optionalDayStartHour(input.dayStartHour),
    actor: requireActor(input.actor),
  };
}

/**
 * Decision 6: Tenant (default settings), one User + OWNER Membership, the first
 * Subscription and one audit row, in one transaction. Nothing else. Interface-
 * agnostic (decision 12): no prompting, printing or process access here.
 */
export async function createTenant(input: CreateTenantInput): Promise<{
  tenantId: string;
  slug: string;
  ownerIdentifier: string;
}> {
  const checked = validateCreateTenantInput(input);
  // Hash outside the transaction (about 100–200 ms).
  const passwordHash = await hashPassword(requireOwnerPassword(input.ownerPassword));
  const now = new Date();

  try {
    return await platformTransaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: { slug: checked.slug, name: checked.name, settings: parseTenantSettings(
            checked.dayStartHour === null ? {} : { dayStartHour: checked.dayStartHour },
          ),
        },
        select: { id: true },
      });
      const user = await tx.user.create({
        data: { identifier: checked.ownerIdentifier, passwordHash },
        select: { id: true },
      });
      await tx.membership.create({
        data: { tenantId: tenant.id, userId: user.id, role: "OWNER", permissions: {} },
      });
      await tx.subscription.create({
        data: {
          tenantId: tenant.id,
          plan: checked.plan,
          startsAt: now,
          paidUntil: checked.paidUntil,
          recordedBy: checked.actor,
        },
      });
      await writeAudit(tx, {
        action: "tenant.create",
        tenantId: tenant.id,
        actor: checked.actor,
        detail: {
          slug: checked.slug,
          name: checked.name,
          plan: checked.plan,
          paidUntil: checked.paidUntil?.toISOString() ?? null,
          ownerIdentifier: checked.ownerIdentifier,
          dayStartHour: checked.dayStartHour,
        },
      });
      return { tenantId: tenant.id, slug: checked.slug, ownerIdentifier: checked.ownerIdentifier };
    });
  } catch (error) {
    if (isUniqueViolation(error, "slug")) throw new DomainError("platform.slug_taken");
    if (isUniqueViolation(error, "identifier")) throw new DomainError("platform.identifier_taken");
    throw error;
  }
}
