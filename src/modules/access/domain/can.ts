export const BOOKINGS_APPROVE = "bookings.approve";
export const BOOKINGS_CREATE = "bookings.create";
export const BOOKINGS_CANCEL = "bookings.cancel";
export const BOOKINGS_NO_SHOW = "bookings.no_show";
export const BOOKINGS_ADJUST_DUE = "bookings.adjust_due";
/** Add 30 minutes to a confirmed game. OWNER yes; STAFF only when the flag is granted (default off). */
export const BOOKINGS_EXTEND = "bookings.extend";
export const PAYMENTS_COLLECT = "payments.collect";
export const EXPENSES_RECORD = "expenses.record";
export const REPORTS_VIEW = "reports.view";
export const SETTINGS_MANAGE = "settings.manage";
export const SHOP_SELL = "shop.sell";
/** Owner only: no flag grants it to staff. */
export const SHOP_MANAGE = "shop.manage";
/** Owner only: rename a person or change their phone. No flag grants it to staff. */
export const PEOPLE_EDIT = "people.edit";
/**
 * Owner only: the currency new games are priced in (DR-007 decision 1). `settings.manage` can be granted
 * to staff by flag, and this changes every price a stadium shows, so it is its own owner-only permission.
 */
export const SETTINGS_GAME_CURRENCY = "settings.game_currency";

export type Permission =
  | typeof BOOKINGS_APPROVE
  | typeof BOOKINGS_CREATE
  | typeof BOOKINGS_CANCEL
  | typeof BOOKINGS_NO_SHOW
  | typeof BOOKINGS_ADJUST_DUE
  | typeof BOOKINGS_EXTEND
  | typeof PAYMENTS_COLLECT
  | typeof EXPENSES_RECORD
  | typeof REPORTS_VIEW
  | typeof SETTINGS_MANAGE
  | typeof SHOP_SELL
  | typeof SHOP_MANAGE
  | typeof PEOPLE_EDIT
  | typeof SETTINGS_GAME_CURRENCY;

export type MembershipLike = {
  role: "OWNER" | "STAFF";
  permissions: unknown;
};

const OWNER_ONLY: ReadonlySet<Permission> = new Set([SHOP_MANAGE, PEOPLE_EDIT, SETTINGS_GAME_CURRENCY]);

/**
 * May this membership do this action on *this* stadium (DR-003 §5).
 * OWNER is always yes. STAFF only if the jsonb flag is strictly true, and never for an
 * owner-only permission (shop.manage, people.edit). STAFF get shop.sell by default: the flag is set on
 * their row (migration for existing rows; the seed and any new STAFF row set it).
 */
export function can(membership: MembershipLike, permission: Permission): boolean {
  if (membership.role === "OWNER") {
    return true;
  }

  if (OWNER_ONLY.has(permission)) {
    return false;
  }

  const flags = membership.permissions;
  if (!flags || typeof flags !== "object" || Array.isArray(flags)) {
    return false;
  }
  return (flags as Record<string, unknown>)[permission] === true;
}
