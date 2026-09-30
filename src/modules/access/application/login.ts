import { trustedClientIp } from "@/lib/client-ip";
import { DomainError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import {
  hitRateLimit,
  pruneRateLimits,
  rateLimitCount,
  resetRateLimit,
} from "@/lib/rate-limit";
import { getCurrentTenant, safeTenantId } from "@/lib/tenant-context";
import { rethrowUnexpected } from "@/lib/use-case-error";
import type { LoginInput } from "@/modules/access/schemas/login";
import { findMembershipForUser } from "@/modules/access/infrastructure/memberships";
import {
  verifyAgainstDummy,
  verifyPassword,
} from "@/modules/access/infrastructure/password";
import {
  LOGIN_BLOCK_MS,
  LOGIN_FAILURE_WINDOW_MS,
  LOGIN_MAX_FAILURES_PER_ACCOUNT,
  LOGIN_MAX_FAILURES_PER_IP,
  loginLimitKeys,
} from "@/modules/access/domain/login-limits";
import { SESSION_LIFETIME_MS } from "@/modules/access/domain/session-lifetime";
import { writeSessionCookie } from "@/modules/access/infrastructure/session-cookie";
import {
  createSession,
  deleteExpiredSessions,
} from "@/modules/access/infrastructure/sessions";
import { findUserByIdentifier } from "@/modules/access/infrastructure/users";

/**
 * URL tenant first, then password, then membership on *this* stadium (DR-003 §3).
 * Same error for unknown user, bad password, or no membership here.
 * Brute force (S-3): 8 failures per account in 15 min → 15-min block
 * (`access.login_throttled`); per-IP only with TRUSTED_CLIENT_IP_HEADER.
 * Must be called from a Server Action (cookie `.set`).
 * User/Session via platformDb; membership via db — not inside one $transaction.
 */
export async function login(input: LoginInput): Promise<void> {
  await getCurrentTenant();

  try {
    const keys = loginLimitKeys(input.identifier, await trustedClientIp());
    if (await isBlocked(keys)) {
      throw new DomainError("access.login_throttled");
    }

    const user = await findUserByIdentifier(input.identifier);
    // Unknown account: same-cost verify, same error (S-4).
    const okHash = user
      ? await verifyPassword(input.password, user.passwordHash)
      : await verifyAgainstDummy(input.password);
    const membership = user && okHash ? await findMembershipForUser(user.id) : null;

    if (!user || !membership) {
      await recordFailure(keys);
      throw new DomainError("access.invalid_login");
    }

    const now = new Date();
    await resetRateLimit(keys.account.failures);
    await pruneRateLimits(24 * 60 * 60 * 1000, now);
    await deleteExpiredSessions(user.id, now);
    const session = await createSession(
      user.id,
      new Date(now.getTime() + SESSION_LIFETIME_MS),
    );
    await writeSessionCookie(session.token);
    logger.info(`Login ${user.id}`, undefined, {
      useCase: "login",
      tenantId: await safeTenantId(),
    });
  } catch (error) {
    await rethrowUnexpected(error, "Login failed", "login");
  }
}

type LimitKeys = ReturnType<typeof loginLimitKeys>;

async function isBlocked(keys: LimitKeys): Promise<boolean> {
  if ((await rateLimitCount(keys.account.block, LOGIN_BLOCK_MS)) > 0) return true;
  return keys.ip !== null && (await rateLimitCount(keys.ip.block, LOGIN_BLOCK_MS)) > 0;
}

/** Count a failure; reaching the limit starts a 15-minute block (S-3). */
async function recordFailure(keys: LimitKeys): Promise<void> {
  const accountFailures = await hitRateLimit(keys.account.failures, LOGIN_FAILURE_WINDOW_MS);
  if (accountFailures >= LOGIN_MAX_FAILURES_PER_ACCOUNT) {
    await resetRateLimit(keys.account.failures);
    await hitRateLimit(keys.account.block, LOGIN_BLOCK_MS);
  }
  if (!keys.ip) return;
  const ipFailures = await hitRateLimit(keys.ip.failures, LOGIN_FAILURE_WINDOW_MS);
  if (ipFailures >= LOGIN_MAX_FAILURES_PER_IP) {
    await resetRateLimit(keys.ip.failures);
    await hitRateLimit(keys.ip.block, LOGIN_BLOCK_MS);
  }
}
