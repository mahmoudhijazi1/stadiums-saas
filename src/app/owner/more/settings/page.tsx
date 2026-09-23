import { redirect } from "next/navigation";

/**
 * The settings monolith moved onto /owner/more.
 * Keep ok/error so a rate or time save still shows its toast.
 * Local Next redirect.md: redirect() throws. Do not catch it.
 */
export default async function OwnerSettingsPage({
  searchParams,
}: PageProps<"/owner/more/settings">) {
  const params = await searchParams;
  const next = new URLSearchParams();
  for (const key of ["ok", "error"] as const) {
    const value = params[key];
    const text = Array.isArray(value) ? value[0] : value;
    if (text) next.set(key, text);
  }
  const qs = next.toString();
  redirect(qs ? `/owner/more?${qs}` : "/owner/more");
}
