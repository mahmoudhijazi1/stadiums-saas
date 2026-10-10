import { redirect } from "next/navigation";
import { getCurrentTenant } from "@/lib/tenant-context";
import { getCurrentMembership } from "@/modules/access/application/get-current-membership";
import type { CurrentMembership } from "@/modules/access/application/get-current-membership";

/** The owner pages' gate: a member, or a redirect to login (or to the suspended page). */
export async function requireOwnerMembership(): Promise<CurrentMembership> {
  const membership = await getCurrentMembership();
  if (!membership) {
    // Suspended goes to its own page, never to login (no loop, decision 7).
    redirect((await getCurrentTenant()).suspended ? "/owner/suspended" : "/owner/login");
  }
  return membership;
}
