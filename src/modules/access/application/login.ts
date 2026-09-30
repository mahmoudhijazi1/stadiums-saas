import { DomainError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { getCurrentTenant, safeTenantId } from "@/lib/tenant-context";
import { rethrowUnexpected } from "@/lib/use-case-error";
import type { LoginInput } from "@/modules/access/schemas/login";
import { findMembershipForUser } from "@/modules/access/infrastructure/memberships";
import { verifyPassword } from "@/modules/access/infrastructure/password";
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
 * Must be called from a Server Action (cookie `.set`).
 * User/Session via platformDb; membership via db — not inside one $transaction.
 */
export async function login(input: LoginInput): Promise<void> {
  await getCurrentTenant();

  try {
    const user = await findUserByIdentifier(input.identifier);
    const okHash = user
      ? await verifyPassword(input.password, user.passwordHash)
      : false;

    if (!user || !okHash) {
      throw new DomainError("access.invalid_login");
    }

    const membership = await findMembershipForUser(user.id);
    if (!membership) {
      throw new DomainError("access.invalid_login");
    }

    const now = new Date();
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
