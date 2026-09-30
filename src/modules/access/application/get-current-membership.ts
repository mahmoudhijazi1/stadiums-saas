import { cache } from "react";
import { getCurrentTenant } from "@/lib/tenant-context";
import type { MembershipRole } from "@/app/generated/prisma/enums";
import { findMembershipForUser } from "@/modules/access/infrastructure/memberships";
import { readSessionCookie } from "@/modules/access/infrastructure/session-cookie";
import { renewedSessionExpiry } from "@/modules/access/domain/session-lifetime";
import {
  extendSession,
  findSessionByToken,
} from "@/modules/access/infrastructure/sessions";

export type CurrentMembership = {
  membershipId: string;
  userId: string;
  identifier: string;
  role: MembershipRole;
  permissions: unknown;
};

/**
 * Cookie → session (not expired; renewed on use) → membership for the *URL* tenant.
 * No membership here (e.g. Ahmad cookie on Sami) → null. Tenant is never read from the session.
 * React cache() so owner layout + page share one lookup (layout.md: layouts cannot pass data to children).
 */
export const getCurrentMembership = cache(
  async (): Promise<CurrentMembership | null> => {
    // Suspended tenant (decision 7): no membership, so every owner use case is
    // access.not_allowed. The session is left untouched (not renewed, not deleted).
    if ((await getCurrentTenant()).suspended) return null;

    const token = await readSessionCookie();
    if (!token) return null;

    const session = await findSessionByToken(token);
    const now = new Date();
    if (!session || session.expiresAt.getTime() <= now.getTime()) {
      return null;
    }
    // Rolling 30 days, written at most once a day. The cookie is renewed by the proxy.
    const renewed = renewedSessionExpiry(session.expiresAt, now);
    if (renewed) await extendSession(session.id, renewed);

    const membership = await findMembershipForUser(session.userId);
    if (!membership) return null;

    return {
      membershipId: membership.id,
      userId: membership.user.id,
      identifier: membership.user.identifier,
      role: membership.role,
      permissions: membership.permissions,
    };
  },
);
