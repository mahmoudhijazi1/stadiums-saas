"use server";

import { redirect } from "next/navigation";
import { login } from "@/modules/access/application/login";
import { logout } from "@/modules/access/application/logout";
import { parseLogin } from "@/modules/access/schemas/login";
import { actionErrorKey } from "@/lib/use-case-error";

function field(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function tenantQuery(tenant: string, extra?: Record<string, string>): string {
  const next = new URLSearchParams();
  if (tenant) next.set("tenant", tenant);
  if (extra) {
    for (const [key, value] of Object.entries(extra)) {
      if (value) next.set(key, value);
    }
  }
  const qs = next.toString();
  return qs ? `?${qs}` : "";
}

/**
 * Thin Server Action. Zod → login. redirect() outside try/catch (Next redirect.md).
 */
export async function submitLogin(formData: FormData) {
  const tenant = field(formData, "tenant");
  let errorKey: string | undefined;
  try {
    const parsed = parseLogin({
      identifier: field(formData, "identifier"),
      password: field(formData, "password"),
    });
    await login(parsed);
  } catch (error) {
    errorKey = await actionErrorKey(error, "submitLogin");
  }
  if (errorKey) {
    redirect(`/login${tenantQuery(tenant, { error: errorKey })}`);
  }
  redirect(`/owner${tenantQuery(tenant)}`);
}

export async function submitLogout(formData: FormData) {
  const tenant = field(formData, "tenant");
  await logout();
  redirect(`/login${tenantQuery(tenant)}`);
}
