import { redirect } from "next/navigation";

/**
 * /owner has no UI. Landing tab is /owner/today (docs/owner-ia.md).
 * Login redirects there directly; this hop is for old bookmarks.
 */
export default async function OwnerIndexPage() {
  redirect("/owner/today");
}
