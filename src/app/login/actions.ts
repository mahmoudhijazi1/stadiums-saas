"use server";

import { redirect } from "next/navigation";
import { logger } from "@/lib/logger";
import { login } from "@/modules/access/application/login";
import { logout } from "@/modules/access/application/logout";
import { parseLogin } from "@/modules/access/schemas/login";

function field(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function tenantQuery(tenant: string, extra?: Record<string, string>): string {
  const next = new URLSearchParams();
  if (tenant) next.set("tenant", tenant);
  if (extra) {
    for (const [key, value] of Object.entries(extra)) {
      next.set(key, value);
    }
  }
  const qs = next.toString();
  return qs ? `?${qs}` : "";
}

/**
 * Thin Server Action. Zod → login. redirect() outside try/catch (Next redirect docs).
 */
export async function submitLogin(formData: FormData) {
  const tenant = field(formData, "tenant");
  let failed = false;
  try {
    const parsed = parseLogin({
      identifier: field(formData, "identifier"),
      password: field(formData, "password"),
    });
    await login(parsed);
  } catch (error) {
    const expected =
      error instanceof Error && error.message === "Invalid login";
    if (!expected) {
      logger.error("Login failed", error);
    }
    failed = true;
  }
  if (failed) {
    redirect(`/login${tenantQuery(tenant, { error: "1" })}`);
  }
  redirect(`/owner${tenantQuery(tenant)}`);
}

export async function submitLogout(formData: FormData) {
  const tenant = field(formData, "tenant");
  await logout();
  redirect(`/login${tenantQuery(tenant)}`);
}
