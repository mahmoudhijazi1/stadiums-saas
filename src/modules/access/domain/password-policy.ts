/**
 * The one password policy: the app (change password), scripts/set-password.ts and
 * scripts/platform.ts all call `checkPassword`. At least 12 characters, not the
 * login identifier, its local part or the tenant slug, not on a small denylist.
 * No composition rules (a phrase with spaces is welcome).
 */
export const MIN_PASSWORD_LENGTH = 12;

/** Passwords that ship in dev data, docs or every "top 10" list and are 12+ characters long. */
export const PASSWORD_DENYLIST: readonly string[] = [
  "dev-owner",
  "dev-owner-password",
  "test-owner-password",
  "owner-password",
  "owner-password1",
  "password1234",
  "password12345",
  "password123456",
  "123456789012",
  "1234567890123",
  "qwertyuiop12",
  "qwertyuiopas",
  "changeme1234",
  "administrator",
  "iloveyou1234",
];

export type PasswordRefusal = "too_short" | "same_as_identifier" | "denylisted";

/** Characters, not UTF-16 units: an emoji or an Arabic letter counts once. */
function length(password: string): number {
  return [...password].length;
}

/**
 * Null when the password is acceptable, else the first reason. `identifier` is the
 * full login ("owner@ahmad"); the tenant slug defaults to the part after the @.
 * Comparisons are case-insensitive and ignore surrounding spaces.
 */
export function checkPassword(
  password: string,
  context: { identifier: string; slug?: string },
): PasswordRefusal | null {
  if (length(password) < MIN_PASSWORD_LENGTH) return "too_short";

  const at = context.identifier.indexOf("@");
  const local = at > 0 ? context.identifier.slice(0, at) : context.identifier;
  const slug = context.slug ?? (at > 0 ? context.identifier.slice(at + 1) : "");
  const candidate = password.trim().toLowerCase();
  const same = [context.identifier, local, slug]
    .map((value) => value.trim().toLowerCase())
    .filter((value) => value !== "");
  if (same.includes(candidate)) return "same_as_identifier";

  if (PASSWORD_DENYLIST.includes(candidate)) return "denylisted";
  return null;
}

/** English text for the operator scripts (the app uses `access.password_*` copy keys). */
export function describePasswordRefusal(refusal: PasswordRefusal): string {
  switch (refusal) {
    case "too_short":
      return `the password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
    case "same_as_identifier":
      return "the password must not be the login, its first part or the stadium slug.";
    case "denylisted":
      return "that password is on the list of passwords everyone tries first.";
  }
}
