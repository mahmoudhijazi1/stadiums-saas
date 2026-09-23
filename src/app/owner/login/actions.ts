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

function loginQuery(extra?: Record<string, string>): string {
  if (!extra) return "";
  const next = new URLSearchParams();
  for (const [key, value] of Object.entries(extra)) {
    if (value) next.set(key, value);
  }
  const qs = next.toString();
  return qs ? `?${qs}` : "";
}

/**
 * Thin Server Action. Zod → login. redirect() outside try/catch (Next redirect.md).
 */
export async function submitLogin(formData: FormData) {
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
    redirect(`/owner/login${loginQuery({ error: errorKey })}`);
  }
  redirect("/owner/today");
}

/**
 * Thin Server Action. logout → login. redirect() outside try/catch (redirect.md).
 */
export async function submitLogout(_formData: FormData) {
  let errorKey: string | undefined;
  try {
    await logout();
  } catch (error) {
    errorKey = await actionErrorKey(error, "submitLogout");
  }
  if (errorKey) {
    redirect(`/owner/login${loginQuery({ error: errorKey })}`);
  }
  redirect("/owner/login");
}
