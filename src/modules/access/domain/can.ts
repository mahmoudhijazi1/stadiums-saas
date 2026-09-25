export const BOOKINGS_APPROVE = "bookings.approve";
export const BOOKINGS_CREATE = "bookings.create";
export const BOOKINGS_CANCEL = "bookings.cancel";
export const BOOKINGS_NO_SHOW = "bookings.no_show";
export const BOOKINGS_ADJUST_DUE = "bookings.adjust_due";
export const PAYMENTS_COLLECT = "payments.collect";
export const EXPENSES_RECORD = "expenses.record";
export const REPORTS_VIEW = "reports.view";
export const SETTINGS_MANAGE = "settings.manage";

export type Permission =
  | typeof BOOKINGS_APPROVE
  | typeof BOOKINGS_CREATE
  | typeof BOOKINGS_CANCEL
  | typeof BOOKINGS_NO_SHOW
  | typeof BOOKINGS_ADJUST_DUE
  | typeof PAYMENTS_COLLECT
  | typeof EXPENSES_RECORD
  | typeof REPORTS_VIEW
  | typeof SETTINGS_MANAGE;

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
