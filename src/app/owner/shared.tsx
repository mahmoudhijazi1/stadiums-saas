import { redirect } from "next/navigation";
import { getCurrentMembership } from "@/modules/access/application/get-current-membership";
import type { CurrentMembership } from "@/modules/access/application/get-current-membership";

export const OWNER_TIME_ZONE = "Asia/Beirut";

export function queryString(
  value: string | string[] | undefined,
): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export function tenantSlugFrom(
  params: { tenant?: string | string[] },
  fallback: string,
): string {
  return typeof params.tenant === "string" && params.tenant.length > 0
    ? params.tenant
    : fallback;
}

export async function requireOwnerMembership(
  tenantSlug: string,
): Promise<CurrentMembership> {
  const membership = await getCurrentMembership();
  if (!membership) {
    const next = new URLSearchParams();
    next.set("tenant", tenantSlug);
    redirect(`/login?${next.toString()}`);
  }
  return membership;
}

export function formatLocalRange(start: Date, end: Date): string {
  return `${formatLocalTime(start)}–${formatLocalTime(end)} (${OWNER_TIME_ZONE})`;
}

function formatLocalTime(value: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: OWNER_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(value);
}
