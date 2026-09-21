import { redirect } from "next/navigation";

export function field(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

/**
 * Keep the tab's local query after POST (bookOn, period, etc.).
 * Tenant is not in FormData — host/subdomain only.
 * Used by today/book/money/settings/pitch actions (2+ tabs) — stays at owner root.
 */
export function ownerQuery(
  formData: FormData,
  keys: readonly string[],
  extra?: Record<string, string>,
): string {
  const next = new URLSearchParams();
  for (const key of keys) {
    const value = field(formData, key);
    if (value) next.set(key, value);
  }
  if (extra) {
    for (const [key, value] of Object.entries(extra)) {
      if (value) next.set(key, value);
    }
  }
  const qs = next.toString();
  return qs ? `?${qs}` : "";
}

export function redirectOwner(
  path: string,
  formData: FormData,
  keys: readonly string[],
  extra?: Record<string, string>,
): never {
  redirect(`${path}${ownerQuery(formData, keys, extra)}`);
}
