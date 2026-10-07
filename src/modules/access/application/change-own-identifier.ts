import { Prisma } from "@/app/generated/prisma/client";
import { DomainError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { getCurrentTenant, safeTenantId } from "@/lib/tenant-context";
import { rethrowUnexpected } from "@/lib/use-case-error";
import {
  clearPasswordFailures,
  requireSelf,
  verifyCurrentPassword,
} from "@/modules/access/application/own-credentials";
import { buildIdentifier } from "@/modules/access/domain/identifier";
import { updateIdentifier } from "@/modules/access/infrastructure/users";

function isIdentifierCollision(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") return false;
  return JSON.stringify(error.meta ?? {}).includes("identifier");
}

/**
 * Change the part of the logged-in user's own login before the @. The server builds the
 * full identifier from the local part and THIS tenant's slug and ignores any suffix the
 * client typed, so another tenant's identifier can never be claimed. Needs the current
 * password (same failure counter as a password change). Sessions stay valid.
 */
export async function changeOwnIdentifier(input: {
  localPart: string;
  currentPassword: string;
}): Promise<{ identifier: string }> {
  const { membership, userId } = await requireSelf();
  const tenant = await getCurrentTenant();

  try {
    const identifier = buildIdentifier(input.localPart, tenant.slug);
    if (!identifier) throw new DomainError("access.identifier_invalid");

    await verifyCurrentPassword(userId, input.currentPassword);

    if (identifier !== membership.identifier) {
      try {
        await updateIdentifier(userId, identifier);
      } catch (error) {
        if (isIdentifierCollision(error)) throw new DomainError("access.identifier_taken");
        throw error;
      }
    }
    await clearPasswordFailures(userId);

    logger.info("Login changed", undefined, {
      useCase: "changeOwnIdentifier",
      tenantId: await safeTenantId(),
    });
    return { identifier };
  } catch (error) {
    return await rethrowUnexpected(error, "Change own identifier failed", "changeOwnIdentifier");
  }
}
