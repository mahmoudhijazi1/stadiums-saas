import { DomainError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { getCurrentTenant, safeTenantId } from "@/lib/tenant-context";
import { rethrowUnexpected } from "@/lib/use-case-error";
import {
  clearPasswordFailures,
  requireSelf,
  verifyCurrentPassword,
} from "@/modules/access/application/own-credentials";
import { checkPassword } from "@/modules/access/domain/password-policy";
import { hashPassword } from "@/modules/access/infrastructure/password";
import { replacePasswordKeepingSession } from "@/modules/access/infrastructure/users";

const REFUSAL_KEYS = {
  too_short: "access.password_too_short",
  same_as_identifier: "access.password_same_as_identifier",
  denylisted: "access.password_denylisted",
} as const;

/**
 * Change the logged-in user's own password. The user comes from the session, never the
 * client. The policy is checked first (it reveals nothing), then the current password
 * (a wrong one is counted, see own-credentials.ts). On success, in one transaction: the
 * new hash is stored and every OTHER session of this user is deleted; the current one
 * stays. Never logs a password.
 */
export async function changeOwnPassword(input: {
  currentPassword: string;
  newPassword: string;
}): Promise<void> {
  const { membership, userId, token } = await requireSelf();
  const tenant = await getCurrentTenant();

  try {
    const refusal = checkPassword(input.newPassword, {
      identifier: membership.identifier,
      slug: tenant.slug,
    });
    if (refusal) throw new DomainError(REFUSAL_KEYS[refusal]);

    await verifyCurrentPassword(userId, input.currentPassword);

    // Hash outside the transaction (about 100 to 200 ms).
    const passwordHash = await hashPassword(input.newPassword);
    await replacePasswordKeepingSession(userId, passwordHash, token);
    await clearPasswordFailures(userId);

    logger.info("Password changed", undefined, {
      useCase: "changeOwnPassword",
      tenantId: await safeTenantId(),
    });
  } catch (error) {
    await rethrowUnexpected(error, "Change own password failed", "changeOwnPassword");
  }
}
