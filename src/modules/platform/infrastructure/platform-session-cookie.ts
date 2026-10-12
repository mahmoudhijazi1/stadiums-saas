import { cookies } from "next/headers";
import { ADMIN_SESSION_ABSOLUTE_MS } from "@/modules/platform/domain/admin-session";

/**
 * The platform admin cookie (DR-006). Over https: `__Host-lebstads_admin`, Secure (the prefix
 * makes it host-only, Path=/, so a tenant subdomain never receives it). Over plain HTTP (local
 * development) a `__Host-` cookie is refused, so it is `lebstads_admin_dev` without Secure.
 * Always HttpOnly, SameSite=Strict, Path=/, 8 hours.
 */
export function adminCookie(protocol: string | undefined = process.env.APP_PROTOCOL) {
  const https = protocol === "https";
  return {
    name: https ? "__Host-lebstads_admin" : "lebstads_admin_dev",
    httpOnly: true,
    secure: https,
    sameSite: "strict" as const,
    path: "/",
    maxAge: ADMIN_SESSION_ABSOLUTE_MS / 1000,
  };
}

export async function readAdminCookie(): Promise<string | undefined> {
  return (await cookies()).get(adminCookie().name)?.value;
}

export async function writeAdminCookie(token: string): Promise<void> {
  const { name, ...flags } = adminCookie();
  (await cookies()).set({ name, value: token, ...flags });
}

export async function clearAdminCookie(): Promise<void> {
  (await cookies()).delete(adminCookie().name);
}
