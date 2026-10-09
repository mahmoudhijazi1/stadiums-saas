import { DomainError } from "@/lib/errors";
import { getCurrentMembership } from "@/modules/access/application/get-current-membership";
import { readSessionCookie } from "@/modules/access/infrastructure/session-cookie";
import { findSessionByToken } from "@/modules/access/infrastructure/sessions";

/**
 * The logged-in user AND the session row behind this request's cookie, for features that tie a
 * record to one device (push subscriptions). Any role. Everything comes from the cookie and the
 * URL's tenant, never from the client. A suspended tenant has no membership, so it is refused here.
 */
export async function requireCurrentSession(): Promise<{ userId: string; sessionId: string }> {
  const membership = await getCurrentMembership();
  if (!membership) throw new DomainError("access.not_allowed");
  const token = await readSessionCookie();
  if (!token) throw new DomainError("access.not_allowed");
  const session = await findSessionByToken(token);
  if (!session || session.userId !== membership.userId) throw new DomainError("access.not_allowed");
  return { userId: membership.userId, sessionId: session.id };
}
