import db from "@/lib/db";

/**
 * Membership for this URL's tenant. Guard injects tenantId — do not pass it (DR-003).
 */
export async function findMembershipForUser(userId: string) {
  return db.membership.findFirst({
    where: { userId },
    select: {
      id: true,
      role: true,
      permissions: true,
      user: { select: { id: true, identifier: true } },
    },
  });
}
