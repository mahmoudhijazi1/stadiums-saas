import { logger } from "@/lib/logger";
import { getCurrentTenant } from "@/lib/tenant-context";
import type { LoginInput } from "@/modules/access/schemas/login";
import { findMembershipForUser } from "@/modules/access/infrastructure/memberships";
import { verifyPassword } from "@/modules/access/infrastructure/password";
import {
  SESSION_MAX_AGE_SECONDS,
  writeSessionCookie,
} from "@/modules/access/infrastructure/session-cookie";
import { createSession } from "@/modules/access/infrastructure/sessions";
import { findUserByIdentifier } from "@/modules/access/infrastructure/users";

const INVALID = "Invalid login";

/**
 * URL tenant first, then password, then membership on *this* stadium (DR-003 §3).
 * Same error for unknown user, bad password, or no membership here.
 * Must be called from a Server Action (cookie `.set`).
 * User/Session via platformDb; membership via db — not inside one $transaction.
 */
export async function login(input: LoginInput): Promise<void> {
  await getCurrentTenant();

  const user = await findUserByIdentifier(input.identifier);
  const okHash = user
    ? await verifyPassword(input.password, user.passwordHash)
    : false;

  if (!user || !okHash) {
    throw new Error(INVALID);
  }

  const membership = await findMembershipForUser(user.id);
  if (!membership) {
    throw new Error(INVALID);
  }

  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);
  const session = await createSession(user.id, expiresAt);
  await writeSessionCookie(session.id, expiresAt);
  logger.info(`Login ${user.id}`);
}
