import db from "@/lib/db";
import { BOOKINGS_APPROVE, can } from "@/modules/access/domain/can";

/**
 * Users of THIS tenant who may approve bookings (OWNER, or STAFF with the flag). Not tied to a
 * request or a session: for system alerts that go to the people who can act. The tenant filter
 * comes from the Prisma extension.
 */
export async function listApproverUserIds(): Promise<string[]> {
  const memberships = await db.membership.findMany({
    select: { userId: true, role: true, permissions: true },
  });
  return memberships.filter((membership) => can(membership, BOOKINGS_APPROVE)).map((membership) => membership.userId);
}
