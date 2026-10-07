import { DomainError } from "@/lib/errors";
import {
  hitRateLimit,
  rateLimitCount,
  resetRateLimit,
} from "@/lib/rate-limit";
import { getCurrentMembership } from "@/modules/access/application/get-current-membership";
import {
  PWCHANGE_BLOCK_MS,
  PWCHANGE_FAILURE_WINDOW_MS,
  PWCHANGE_MAX_FAILURES,
  pwChangeKeys,
} from "@/modules/access/domain/credential-limits";
import { verifyPassword } from "@/modules/access/infrastructure/password";
import { readSessionCookie } from "@/modules/access/infrastructure/session-cookie";
import { findUserById } from "@/modules/access/infrastructure/users";

/**
 * Shared by the "change my own credentials" use cases. The user always comes from the
 * session (never from the client); the only authorization is a membership on this
 * tenant, so any role may change its OWN credentials and nobody else's. A suspended
 * tenant has no membership (get-current-membership.ts), so it is refused here too.
 */
export async function requireSelf() {
  const membership = await getCurrentMembership();
  if (!membership) throw new DomainError("access.not_allowed");
  const token = await readSessionCookie();
  if (!token) throw new DomainError("access.not_allowed");
  return { membership, userId: membership.userId, token };
}

/**
 * Block check, then verify the current password. A wrong password counts as a failure
 * (5 in 15 minutes, then a 15-minute block). Separate from the login counter. The
 * block message is generic: it does not say whether the password was right.
 */
export async function verifyCurrentPassword(userId: string, currentPassword: string) {
  const keys = pwChangeKeys(userId);
  if ((await rateLimitCount(keys.block, PWCHANGE_BLOCK_MS)) > 0) {
    throw new DomainError("access.password_change_throttled");
  }
  const user = await findUserById(userId);
  if (!user) throw new DomainError("access.not_allowed");

  if (!(await verifyPassword(currentPassword, user.passwordHash))) {
    const failures = await hitRateLimit(keys.failures, PWCHANGE_FAILURE_WINDOW_MS);
    if (failures >= PWCHANGE_MAX_FAILURES) {
      await resetRateLimit(keys.failures);
      await hitRateLimit(keys.block, PWCHANGE_BLOCK_MS);
    }
    throw new DomainError("access.current_password_wrong");
  }
  return user;
}

export async function clearPasswordFailures(userId: string) {
  await resetRateLimit(pwChangeKeys(userId).failures);
}
