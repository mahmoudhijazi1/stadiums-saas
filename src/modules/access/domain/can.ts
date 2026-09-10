export const BOOKINGS_APPROVE = "bookings.approve";

export type Permission = typeof BOOKINGS_APPROVE;

export type MembershipLike = {
  role: "OWNER" | "STAFF";
  permissions: unknown;
};

/**
 * May this membership do this action on *this* stadium (DR-003 §5).
 * OWNER is always yes. STAFF only if the jsonb flag is strictly true.
 */
export function can(membership: MembershipLike, permission: Permission): boolean {
  if (membership.role === "OWNER") {
    return true;
  }

  const flags = membership.permissions;
  if (!flags || typeof flags !== "object" || Array.isArray(flags)) {
    return false;
  }
  return (flags as Record<string, unknown>)[permission] === true;
}
