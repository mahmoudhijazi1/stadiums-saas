import { redirect } from "next/navigation";
import { requireOwnerMembership } from "@/app/owner/shared";

/**
 * /owner has no UI. Landing tab is /owner/today (docs/owner-ia.md).
 * Login redirects there directly; this hop is for old bookmarks.
 */
export default async function OwnerIndexPage() {
  await requireOwnerMembership();
  redirect("/owner/today");
}
