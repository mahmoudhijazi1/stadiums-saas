"use server";

import { redirect } from "next/navigation";
import { trustedClientIp } from "@/lib/client-ip";
import { requirePlatformHost } from "@/lib/require-platform-host";
import { actionErrorKey } from "@/lib/use-case-error";
import { platformLogin } from "@/modules/platform/application/platform-login";
import {
  getCurrentPlatformAdmin,
  platformLogout,
  setPlatformSessionCookie,
} from "@/modules/platform/application/platform-session";
import { parsePlatformLogin } from "@/modules/platform/schemas/login";

function field(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

/**
 * Thin Server Actions (DR-006). Each one runs the host guard first, whatever the proxy did.
 * Login: validate, delegate, write the cookie, redirect (redirect() outside try/catch, redirect.md).
 * Any failure but a block shows the same generic message.
 */
export async function submitPlatformLogin(formData: FormData) {
  await requirePlatformHost();
  let failure: string | undefined;
  try {
    const parsed = parsePlatformLogin({
      identifier: field(formData, "identifier"),
      password: field(formData, "password"),
      code: field(formData, "code"),
    });
    const { token } = await platformLogin({ ...parsed, ip: await trustedClientIp() });
    await setPlatformSessionCookie(token);
  } catch (error) {
    const key = await actionErrorKey(error, "submitPlatformLogin");
    failure = key === "platform.login_blocked" ? key : "platform.login_failed";
  }
  if (failure) redirect(`/platform/login?error=${failure}`);
  redirect("/platform");
}

/** Logout needs a session: without one nothing is deleted and the visitor goes to the login. */
export async function submitPlatformLogout() {
  await requirePlatformHost();
  if (!(await getCurrentPlatformAdmin())) redirect("/platform/login");
  await platformLogout();
  redirect("/platform/login");
}
