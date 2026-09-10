import type { MembershipRole } from "@/app/generated/prisma/enums";
import { findMembershipForUser } from "@/modules/access/infrastructure/memberships";
import { readSessionCookie } from "@/modules/access/infrastructure/session-cookie";
import { findSessionById } from "@/modules/access/infrastructure/sessions";

export type CurrentMembership = {
  userId: string;
  identifier: string;
  role: MembershipRole;
  permissions: unknown;
};

/**
 * Cookie → session (not expired) → membership for the *URL* tenant.
 * No membership here (e.g. Ahmad cookie on Sami) → null. Tenant is never read from the session.
 */
export async function getCurrentMembership(): Promise<CurrentMembership | null> {
  const id = await readSessionCookie();
  if (!id) return null;

  const session = await findSessionById(id);
  if (!session || session.expiresAt.getTime() <= Date.now()) {
    return null;
  }

  const membership = await findMembershipForUser(session.userId);
  if (!membership) return null;

  return {
    userId: membership.user.id,
    identifier: membership.user.identifier,
    role: membership.role,
    permissions: membership.permissions,
  };
}
